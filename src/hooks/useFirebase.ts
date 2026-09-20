import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { onAuthStateChanged, getRedirectResult, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "../lib/firebase";
import { useAppContext } from "../context/AppContext";
import { useBrewContext } from "../context/BrewContext";
import { CLOUD_DOC_KEY, DATA_SCHEMA_VERSION, DEFAULT_SETTINGS, STORAGE_KEY } from "../constants";
import { describeAuthError, describeCloudError } from "../utils";
import { deepClean } from "../utils/hydration";
import { CloudConflictError, CloudSyncQueue, type PendingCloudChange, type SyncPhase } from "../lib/cloudSyncQueue";
import { hasDiaryData, parseAndMigratePayload } from "../lib/localDiary";
import type { PersistedPayload } from "../types";

type RemoteSnapshot = { data: Record<string, unknown>; revision: number };
type SyncInit = { uid: string; revision: number; pending?: boolean; conflict?: boolean; originalRevision?: number };
class PendingSnapshotError extends Error {}
const CLOUD_WAIT_MS = 15_000;

const pendingKey = (uid: string) => `${STORAGE_KEY}:cloud-pending:${uid}`;
const backupKey = (uid: string) => `${STORAGE_KEY}:sync-backup:${uid}:${Date.now()}:${crypto.randomUUID()}`;
const preLoadBackupKey = (uid: string) => `${STORAGE_KEY}:pre-cloud-backup:${uid}`;
const baselineKey = (uid: string) => `${STORAGE_KEY}:cloud-baseline:${uid}`;
const revisionOf = (data: Record<string, unknown>) =>
  typeof data.syncRevision === "number" && Number.isSafeInteger(data.syncRevision) && data.syncRevision >= 0
    ? data.syncRevision : 0;

const readPending = (uid: string): PendingCloudChange | null => {
  const raw = localStorage.getItem(pendingKey(uid));
  if (!raw) return null;
  let parsed: PendingCloudChange;
  try {
    parsed = JSON.parse(raw) as PendingCloudChange;
  } catch {
    throw new PendingSnapshotError("저장 대기 중인 로컬 데이터가 손상되어 자동 동기화를 중지했습니다.");
  }
  if (!parsed || !Number.isSafeInteger(parsed.revision) || parsed.revision < 0) {
    throw new PendingSnapshotError("저장 대기 중인 로컬 데이터가 손상되어 자동 동기화를 중지했습니다.");
  }
  try { return { ...parsed, payload: parseAndMigratePayload(parsed.payload) }; }
  catch { throw new PendingSnapshotError("저장 대기 중인 로컬 데이터가 손상되어 자동 동기화를 중지했습니다."); }
};

const comparablePayload = (source: Record<string, unknown>) => ({
  profiles: source.profiles ?? {}, records: source.records ?? [], beans: source.beans ?? [],
  inventory: source.inventory ?? [], recipes: source.recipes ?? [],
  settings: source.settings ?? DEFAULT_SETTINGS,
  beanSortMode: source.beanSortMode ?? "newest", beanSortOrder: source.beanSortOrder ?? "desc",
  inventorySortMode: source.inventorySortMode ?? "newest", inventorySortOrder: source.inventorySortOrder ?? "desc",
  recipeSortMode: source.recipeSortMode ?? "newest", recipeSortOrder: source.recipeSortOrder ?? "desc",
});

const stableShape = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableShape);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, stableShape(entry)]));
  }
  return value;
};

const payloadSignature = (payload: PersistedPayload) =>
  JSON.stringify(stableShape(comparablePayload(payload as unknown as Record<string, unknown>)));

const payloadsDiffer = (local: PersistedPayload, remote: RemoteSnapshot) =>
  payloadSignature(local) !== JSON.stringify(stableShape(comparablePayload(remote.data)));

const withinCloudWait = <T>(task: Promise<T>) => Promise.race([
  task,
  new Promise<never>((_, reject) => setTimeout(() => reject(new Error("cloud-timeout")), CLOUD_WAIT_MS)),
]);

export const useFirebase = () => {
  const {
    user, switchAccount, authReady, setAuthReady, setCloudReady, setCloudStatus, setCloudStatusVisual,
    replacePersistedPayload,
    triggerCloudSaveToast, persistedPayload, cloudSyncTick, localHydrated,
  } = useAppContext();
  const { dispatch: dispatchBrewForm } = useBrewContext();
  const [syncInit, setSyncInit] = useState<SyncInit | null>(null);
  const [bootstrapRetryTick, setBootstrapRetryTick] = useState(0);
  const latestPayload = useRef(persistedPayload);
  latestPayload.current = persistedPayload;
  const activeUid = useRef(user?.uid);
  activeUid.current = user?.uid;
  const bootstrapFailed = useRef(false);

  const report = (phase: SyncPhase, error?: unknown) => {
    if (phase === "pending") {
      setCloudStatus("로컬 보관됨 · 클라우드 저장 대기 중");
      setCloudStatusVisual("loading");
    } else if (phase === "saving") {
      setCloudStatus("클라우드 저장 중...");
      setCloudStatusVisual("loading");
    } else if (phase === "saved") {
      setCloudStatus("클라우드 저장 완료");
      setCloudStatusVisual("success");
      const uid = activeUid.current;
      if (uid) {
        try { localStorage.setItem(baselineKey(uid), payloadSignature(latestPayload.current)); }
        catch (error) { console.error("Failed to save cloud baseline", error); }
      }
      triggerCloudSaveToast();
    } else if (phase === "conflict") {
      setCloudStatus("로컬·클라우드 변경 충돌 · 이 기기 데이터 보존됨");
      setCloudStatusVisual("error");
    } else {
      const timedOut = error instanceof Error && error.message === "cloud-timeout";
      setCloudStatus(error instanceof PendingSnapshotError ? error.message : timedOut ? "클라우드 연결 지연 · 로컬 저장됨 · 네트워크 확인 후 재시도하세요." : error ? describeCloudError(error) : "클라우드 저장 실패");
      setCloudStatusVisual("error");
    }
  };

  const queueRef = useRef<CloudSyncQueue | null>(null);
  if (!queueRef.current) {
    queueRef.current = new CloudSyncQueue({
      write: async (uid, expectedRevision, payload) => {
        if (!db) throw new Error("Firebase is not configured");
        const ref = doc(db, "coffeeDiaries", uid);
        return runTransaction(db, async (transaction) => {
          const current = await transaction.get(ref);
          const revision = current.exists() ? revisionOf(current.data() as Record<string, unknown>) : 0;
          if (revision !== expectedRevision) throw new CloudConflictError();
          const nextRevision = revision + 1;
          transaction.set(ref, {
            ...deepClean(payload), schemaVersion: DATA_SCHEMA_VERSION, syncRevision: nextRevision, updatedAt: serverTimestamp(),
          });
          return nextRevision;
        });
      },
      persist: (uid, change) => localStorage.setItem(pendingKey(uid), JSON.stringify(change)),
      clear: (uid) => localStorage.removeItem(pendingKey(uid)),
      report,
    });
  }
  const queue = queueRef.current;

  const getCloudDocRef = (uid: string) => db ? doc(db, "coffeeDiaries", uid) : null;
  const getLegacyCloudDocRef = (uid: string) => db ? doc(db, "users", uid, "coffeeDiary", CLOUD_DOC_KEY) : null;

  const migrateLegacy = async (uid: string): Promise<RemoteSnapshot | null> => {
    if (!db) return null;
    const oldRef = getLegacyCloudDocRef(uid);
    const ref = getCloudDocRef(uid);
    if (!oldRef || !ref) return null;
    const legacy = await getDoc(oldRef);
    if (!legacy.exists()) return null;
    const legacyData = legacy.data() as Record<string, unknown>;
    parseAndMigratePayload(legacyData);
    // A second device can migrate at the same time. Only create if still absent.
    return runTransaction(db, async (transaction) => {
      const current = await transaction.get(ref);
      if (current.exists()) {
        const data = current.data() as Record<string, unknown>;
        return { data: parseAndMigratePayload(data), revision: revisionOf(data) };
      }
      const data = { ...legacyData, syncRevision: 1 };
      transaction.set(ref, { ...data, migratedFromLegacyAt: serverTimestamp(), updatedAt: serverTimestamp() });
      return { data: parseAndMigratePayload(data), revision: 1 };
    });
  };

  const readRemote = async (uid: string): Promise<RemoteSnapshot | null> => {
    const ref = getCloudDocRef(uid);
    if (!ref) return null;
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return migrateLegacy(uid);
    const data = snapshot.data() as Record<string, unknown>;
    return { data: parseAndMigratePayload(data), revision: revisionOf(data) };
  };

  const applyRemote = (remote: RemoteSnapshot) => {
    replacePersistedPayload(remote.data as PersistedPayload);
  };

  // Authentication is the only entry point for a cloud session.
  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      return;
    }
    void getRedirectResult(auth).catch((error) => setCloudStatus(describeAuthError(error)));
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      activeUid.current = nextUser?.uid;
      bootstrapFailed.current = false;
      queue.stop();
      setSyncInit(null);
      setCloudReady(false);
      switchAccount(nextUser);
      dispatchBrewForm({ type: "RESET_FORM" });
      setAuthReady(true);
    });
    return unsubscribe;
  }, [setAuthReady, setCloudReady, setCloudStatus]);

  useEffect(() => {
    if (!authReady) return;
    if (!localHydrated) {
      setCloudReady(true);
      return;
    }
    if (!user || !db) {
      bootstrapFailed.current = false;
      queue.stop();
      setSyncInit(null);
      setCloudStatus("로컬 모드");
      setCloudStatusVisual("idle");
      setCloudReady(true);
      return;
    }
    let alive = true;
    const uid = user.uid;
    queue.stop();
    setSyncInit(null);
    setCloudReady(false);
    bootstrapFailed.current = false;
    setCloudStatus("클라우드 동기화 준비 중...");
    setCloudStatusVisual("loading");
    void (async () => {
      try {
        const remote = await withinCloudWait(readRemote(uid));
        if (!alive || activeUid.current !== uid) return;
        const pending = readPending(uid);
        if (pending) {
          replacePersistedPayload(pending.payload);
          const revision = remote?.revision ?? 0;
          const conflict = pending.conflict === true || pending.revision !== revision;
          setSyncInit({ uid, revision, pending: !conflict, conflict, originalRevision: pending.revision });
          if (conflict) report("conflict");
        } else if (remote) {
          // Keep one copy of account-local data before cloud hydration.
          if (hasDiaryData(latestPayload.current) && !localStorage.getItem(preLoadBackupKey(uid))) {
            localStorage.setItem(preLoadBackupKey(uid), JSON.stringify(latestPayload.current));
          }
          const localUnchanged = localStorage.getItem(baselineKey(uid)) === payloadSignature(latestPayload.current);
          if (hasDiaryData(latestPayload.current) && !localUnchanged && payloadsDiffer(latestPayload.current, remote)) {
            setSyncInit({ uid, revision: remote.revision, conflict: true, originalRevision: remote.revision });
            report("conflict");
          } else {
            applyRemote(remote);
            setSyncInit({ uid, revision: remote.revision });
            setCloudStatus("클라우드 데이터 로드됨");
            setCloudStatusVisual("success");
          }
        } else if (hasDiaryData(latestPayload.current)) {
          setSyncInit({ uid, revision: 0, pending: true });
          setCloudStatus("계정 로컬 데이터 · 클라우드 저장 대기 중");
          setCloudStatusVisual("loading");
        } else {
          setSyncInit({ uid, revision: 0 });
          setCloudStatus("클라우드 데이터 없음 · 새 변경부터 자동 저장");
          setCloudStatusVisual("idle");
        }
      } catch (error) {
        if (alive && activeUid.current === uid) {
          bootstrapFailed.current = !(error instanceof PendingSnapshotError);
          setCloudStatus(error instanceof PendingSnapshotError ? error.message : describeCloudError(error));
          setCloudStatusVisual("error");
        }
      } finally {
        if (alive && activeUid.current === uid) setCloudReady(true);
      }
    })();
    return () => { alive = false; queue.stop(); };
  }, [user, authReady, localHydrated, bootstrapRetryTick]);

  // This runs after cloud hydration (or recovery of an unsent local snapshot).
  useLayoutEffect(() => {
    if (syncInit && user?.uid === syncInit.uid) {
      if (queue.accountId !== syncInit.uid) {
        queue.start(syncInit.uid, syncInit.revision, persistedPayload, syncInit.pending, syncInit.conflict, syncInit.originalRevision);
        if (!syncInit.pending && !syncInit.conflict) {
          try { localStorage.setItem(baselineKey(syncInit.uid), payloadSignature(persistedPayload)); }
          catch (error) { console.error("Failed to save cloud baseline", error); }
        }
      }
    }
  }, [syncInit]);

  // Observe the complete persisted payload, including record edits/deletions and
  // settings/sort changes that previously never called queueCloudSync().
  useLayoutEffect(() => {
    if (syncInit && user?.uid === syncInit.uid) queue.observe(persistedPayload);
  }, [persistedPayload, syncInit, user]);

  useEffect(() => {
    if (cloudSyncTick > 0 && syncInit && user?.uid === syncInit.uid) {
      queue.observe(latestPayload.current);
      void queue.flush();
    }
  }, [cloudSyncTick]);

  useEffect(() => {
    const retryPending = () => {
      if (queue.hasPending && !queue.isConflict) void queue.flush();
      else if (bootstrapFailed.current && activeUid.current) setBootstrapRetryTick((tick) => tick + 1);
    };
    const retryWhenVisible = () => {
      if (document.visibilityState === "visible") retryPending();
    };
    window.addEventListener("online", retryPending);
    document.addEventListener("visibilitychange", retryWhenVisible);
    return () => {
      window.removeEventListener("online", retryPending);
      document.removeEventListener("visibilitychange", retryWhenVisible);
    };
  }, []);

  const saveToCloud = async (_payload: PersistedPayload, options?: { withVisual?: boolean }) => {
    if (!user || !db) return;
    const uid = user.uid;
    if (options?.withVisual) {
      setCloudStatus("클라우드 저장 준비 중...");
      setCloudStatusVisual("loading");
    }
    if (!await queue.waitForWrite(CLOUD_WAIT_MS)) {
      setCloudStatus("클라우드 연결 지연 · 로컬 저장됨 · 네트워크 확인 후 재시도하세요.");
      setCloudStatusVisual("error");
      return;
    }
    if (activeUid.current !== uid) return;
    if (queue.accountId !== uid || queue.isConflict) {
      const remote = await withinCloudWait(readRemote(uid)).catch((error) => {
        report("error", error);
        return undefined;
      });
      if (remote === undefined) return;
      if (activeUid.current !== uid) return;
      const message = queue.isConflict
        ? "다른 기기의 변경을 이 기기 데이터로 덮어쓸까요? 덮어쓰기 전 클라우드 데이터를 로컬에 백업합니다."
        : "이 계정의 로컬 데이터를 클라우드에 저장할까요? 기존 클라우드 데이터는 먼저 백업합니다.";
      if (!window.confirm(message)) {
        report(queue.isConflict ? "conflict" : "pending");
        return;
      }
      if (remote) {
        try {
          localStorage.setItem(backupKey(uid), JSON.stringify(remote.data));
        } catch (error) {
          report("error", error);
          return;
        }
      }
      queue.start(uid, remote?.revision ?? 0, latestPayload.current, true);
      if (!syncInit) setSyncInit({ uid, revision: remote?.revision ?? 0 });
    } else {
      queue.force(latestPayload.current);
    }
    void queue.flush();
    if (!await queue.waitForWrite(CLOUD_WAIT_MS)) {
      setCloudStatus("클라우드 연결 지연 · 로컬 저장됨 · 네트워크 확인 후 재시도하세요.");
      setCloudStatusVisual("error");
    }
  };

  const loadFromCloud = async (options?: { withVisual?: boolean }) => {
    if (!user || !db) return;
    const uid = user.uid;
    if (!await queue.waitForWrite(CLOUD_WAIT_MS)) {
      report("error", new Error("cloud-timeout"));
      return;
    }
    if (activeUid.current !== uid) return;
    if (options?.withVisual) {
      setCloudStatus("클라우드 불러오는 중...");
      setCloudStatusVisual("loading");
    }
    try {
      const remote = await withinCloudWait(readRemote(uid));
      if (activeUid.current !== uid) return;
      if (!remote) {
        setCloudStatus("클라우드 데이터 없음");
        setCloudStatusVisual("idle");
        return;
      }
      const hadPending = queue.hasPending || Boolean(readPending(uid));
      if (hadPending) {
        if (!window.confirm("이 기기의 미저장 변경을 로컬에 백업하고 클라우드 데이터로 바꿀까요?")) {
          report(queue.isConflict ? "conflict" : "pending");
          return;
        }
      }
      if (hadPending || hasDiaryData(latestPayload.current)) {
        localStorage.setItem(backupKey(uid), JSON.stringify(latestPayload.current));
      }
      queue.stop();
      localStorage.removeItem(pendingKey(uid));
      applyRemote(remote);
      setSyncInit({ uid, revision: remote.revision });
      setCloudStatus("클라우드 불러오기 완료");
      setCloudStatusVisual("success");
    } catch (error) {
      report("error", error);
    }
  };

  const login = async () => {
    if (!auth) {
      setCloudStatus("Firebase 인증 객체가 없습니다.");
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setCloudStatus(describeAuthError(error));
    }
  };

  const logout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (error) {
      setCloudStatus(describeAuthError(error));
    }
  };

  return { loadFromCloud, saveToCloud, login, logout };
};
