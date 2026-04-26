import { useEffect } from "react";
import { 
  onAuthStateChanged, 
  getRedirectResult,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { 
  getDoc, 
  setDoc, 
  doc, 
  serverTimestamp 
} from "firebase/firestore";
import { auth, db, googleProvider } from "../lib/firebase";
import { useAppContext } from "../context/AppContext";
import { useBrewContext } from "../context/BrewContext";
import { CLOUD_DOC_KEY } from "../constants";
import { describeAuthError, describeCloudError } from "../utils";
import { hydratePersistedData, deepClean } from "../utils/hydration";
import { PersistedPayload } from "../types";

export const useFirebase = () => {
  const {
    user, setUser,
    setAuthReady,
    setCloudReady,
    setCloudStatus,
    setCloudStatusVisual,
    setProfiles, setBeans, setSettings, setInventory, setRecipes, setRecords,
    triggerCloudSaveToast,
    persistedPayload,
    cloudSyncTick,
    cloudReady
  } = useAppContext();

  const { dispatch: dispatchBrewForm } = useBrewContext();

  const getCloudDocRef = (uid: string) => {
    if (!db) return null;
    return doc(db, "coffeeDiaries", uid);
  };

  const getLegacyCloudDocRef = (uid: string) => {
    if (!db) return null;
    return doc(db, "users", uid, "coffeeDiary", CLOUD_DOC_KEY);
  };

  const scheduleCloudIdleStatus = () => {
    setTimeout(() => {
      setCloudStatus("클라우드 대기중");
      setCloudStatusVisual("idle");
    }, 5000);
  };

  const loadFromCloud = async (options?: { withVisual?: boolean }) => {
    if (!user || !db) return;
    const withVisual = options?.withVisual ?? false;
    
    if (withVisual) {
      setCloudStatus("클라우드 불러오는 중...");
      setCloudStatusVisual("loading");
    }

    try {
      const currentRef = getCloudDocRef(user.uid);
      const legacyRef = getLegacyCloudDocRef(user.uid);
      if (!currentRef) return;

      const currentSnap = await getDoc(currentRef);
      const hydrationSetters = { setProfiles, setBeans, setSettings, setInventory, setRecipes, setRecords, dispatchBrewForm };

      if (currentSnap.exists()) {
        hydratePersistedData(currentSnap.data() as Record<string, unknown>, hydrationSetters);
        setCloudStatus("클라우드 불러오기 완료");
        if (withVisual) {
          setCloudStatusVisual("success");
          scheduleCloudIdleStatus();
        }
        return;
      }

      if (legacyRef) {
        const legacySnap = await getDoc(legacyRef);
        if (legacySnap.exists()) {
          const legacyData = legacySnap.data() as Record<string, unknown>;
          hydratePersistedData(legacyData, hydrationSetters);
          await setDoc(currentRef, { ...legacyData, migratedFromLegacyAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
          setCloudStatus("클라우드 불러오기 완료 (구버전 데이터 마이그레이션)");
          if (withVisual) {
            setCloudStatusVisual("success");
            scheduleCloudIdleStatus();
          }
          return;
        }
      }

      setCloudStatus("클라우드 데이터 없음");
      if (withVisual) {
        setCloudStatusVisual("success");
        scheduleCloudIdleStatus();
      }
    } catch (error) {
      setCloudStatus(describeCloudError(error));
      if (withVisual) setCloudStatusVisual("error");
    }
  };

  const saveToCloud = async (payload: PersistedPayload, options?: { withVisual?: boolean }) => {
    if (!user || !db) return;
    const withVisual = options?.withVisual ?? false;
    const sanitizedPayload = deepClean(payload);

    if (withVisual) {
      setCloudStatus("클라우드 저장 중...");
      setCloudStatusVisual("loading");
    }
    try {
      const ref = getCloudDocRef(user.uid);
      if (!ref) return;
      await setDoc(ref, { ...sanitizedPayload, updatedAt: serverTimestamp() });
      setCloudStatus("클라우드 저장 완료");
      triggerCloudSaveToast();
      if (withVisual) {
        setCloudStatusVisual("success");
        scheduleCloudIdleStatus();
      }
    } catch (error) {
      setCloudStatus(describeCloudError(error));
      if (withVisual) setCloudStatusVisual("error");
    }
  };

  // Auth bootstrap
  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      return;
    }

    void getRedirectResult(auth).catch((error) => {
      setCloudStatus(describeAuthError(error));
    });

    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      console.log("🔥 Firebase Auth Changed: ", nextUser?.email || "Guest");
      setAuthReady(true);
    });
    return unsub;
  }, [setAuthReady, setCloudStatus, setUser]);

  // Cloud Bootstrap
  useEffect(() => {
    if (!user || !db) {
      console.log("☁️ Cloud ready directly (No user or DB)");
      setCloudReady(true);
      return;
    }

    let alive = true;
    const bootstrap = async () => {
      setCloudStatus("클라우드 동기화 준비 중...");
      setCloudStatusVisual("idle");
      try {
        const ref = getCloudDocRef(user.uid);
        if (!ref) return;
        const snap = await getDoc(ref);
        if (!alive) return;

        const hydrationSetters = { setProfiles, setBeans, setSettings, setInventory, setRecipes, setRecords, dispatchBrewForm };

        if (snap.exists()) {
          hydratePersistedData(snap.data() as Record<string, unknown>, hydrationSetters);
          setCloudStatus("클라우드 데이터 로드됨");
        } else {
          const legacyRef = getLegacyCloudDocRef(user.uid);
          if (!legacyRef) return;
          const legacySnap = await getDoc(legacyRef);
          if (!alive) return;
          if (legacySnap.exists()) {
            const legacyData = legacySnap.data() as Record<string, unknown>;
            hydratePersistedData(legacyData, hydrationSetters);
            await setDoc(ref, { ...legacyData, migratedFromLegacyAt: serverTimestamp(), updatedAt: serverTimestamp() });
            if (!alive) return;
            setCloudStatus("클라우드 데이터 로드됨 (구버전 데이터 마이그레이션)");
          } else {
            const hasData = (persistedPayload.records?.length > 0) || 
                            (persistedPayload.beans?.length > 0) || 
                            (persistedPayload.inventory?.length > 0);
            
            if (hasData) {
              await setDoc(ref, { ...persistedPayload, updatedAt: serverTimestamp() });
              if (!alive) return;
              setCloudStatus("클라우드 최초 동기화 완료");
            } else {
              setCloudStatus("클라우드 데이터 없음 (신규 사용자)");
            }
          }
        }
      } catch (error) {
        if (!alive) return;
        setCloudStatus(describeCloudError(error));
      } finally {
        if (alive) setCloudReady(true);
      }
    };

    void bootstrap();
    return () => {
      alive = false;
    };
  }, [user]);

  // Handle triggered cloud syncs
  useEffect(() => {
    if (cloudSyncTick > 0 && user && cloudReady) {
      void saveToCloud(persistedPayload, { withVisual: false });
    }
  }, [cloudSyncTick, user, cloudReady]);
  
  const login = async () => {
    if (!auth) {
      setCloudStatus("Firebase 인증 객체가 없습니다.");
      return;
    }
    try {
      console.log("🚀 Starting Google Login Popup...");
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Auth Error:", error);
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

  return {
    loadFromCloud,
    saveToCloud,
    login,
    logout
  };
};
