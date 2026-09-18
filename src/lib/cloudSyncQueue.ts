import type { PersistedPayload } from "../types";

export class CloudConflictError extends Error {
  constructor() {
    super("Cloud data changed on another device");
    this.name = "CloudConflictError";
  }
}

export type PendingCloudChange = { revision: number; payload: PersistedPayload; conflict?: boolean };
export type SyncPhase = "pending" | "saving" | "saved" | "error" | "conflict";

type Dependencies = {
  write: (uid: string, revision: number, payload: PersistedPayload) => Promise<number>;
  persist: (uid: string, change: PendingCloudChange) => void;
  clear: (uid: string) => void;
  report: (phase: SyncPhase, error?: unknown) => void;
};

/** One ordered writer per signed-in account. Every observed edit is durably staged first. */
export class CloudSyncQueue {
  private uid: string | null = null;
  private revision = 0;
  private baseline = "";
  private latest = "";
  private payload: PersistedPayload | null = null;
  private dirty = false;
  private conflict = false;
  private conflictBaseRevision: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private generation = 0;
  private readonly deps: Dependencies;
  private readonly delayMs: number;

  constructor(deps: Dependencies, delayMs = 600) {
    this.deps = deps;
    this.delayMs = delayMs;
  }

  start(uid: string, revision: number, payload: PersistedPayload, pending = false, conflict = false, originalRevision?: number) {
    this.stop();
    this.uid = uid;
    this.revision = revision;
    this.payload = payload;
    this.latest = JSON.stringify(payload);
    this.baseline = pending ? "" : this.latest;
    this.dirty = pending || conflict;
    this.conflict = conflict;
    this.conflictBaseRevision = conflict ? (originalRevision ?? revision) : null;
    if (conflict) this.deps.report("conflict");
    else if (pending) {
      this.stage();
      this.schedule();
    }
  }

  stop() {
    this.generation += 1;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.uid = null;
    this.payload = null;
    this.dirty = false;
    this.conflict = false;
    this.conflictBaseRevision = null;
  }

  get hasPending() { return this.dirty; }
  get isConflict() { return this.conflict; }
  get accountId() { return this.uid; }
  get currentRevision() { return this.revision; }

  observe(payload: PersistedPayload) {
    if (!this.uid) return;
    const next = JSON.stringify(payload);
    if (next === this.latest) return;
    this.payload = payload;
    this.latest = next;
    // Reverting an edit while its older value is in flight still needs a
    // durable follow-up write after that request commits.
    this.dirty = next !== this.baseline || this.conflict || this.inFlight !== null;
    if (!this.dirty) {
      this.deps.clear(this.uid);
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      return;
    }
    this.stage();
    if (!this.conflict) this.schedule();
  }

  force(payload: PersistedPayload) {
    if (!this.uid) return;
    this.payload = payload;
    this.latest = JSON.stringify(payload);
    this.dirty = true;
    this.stage();
  }

  private stage() {
    if (!this.uid || !this.payload) return;
    try {
      this.deps.persist(this.uid, {
        revision: this.conflictBaseRevision ?? this.revision,
        payload: this.payload,
        ...(this.conflict ? { conflict: true } : {}),
      });
      this.deps.report(this.conflict ? "conflict" : "pending");
    } catch (error) {
      this.deps.report("error", error);
    }
  }

  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.delayMs);
  }

  async flush(): Promise<void> {
    if (this.inFlight) {
      await this.inFlight;
      if (this.dirty && !this.conflict) await this.flush();
      return;
    }
    if (!this.uid || !this.payload || !this.dirty || this.conflict) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const uid = this.uid;
    const payload = this.payload;
    const serialized = this.latest;
    const generation = this.generation;
    const revision = this.revision;
    this.deps.report("saving");
    const task = (async () => {
      try {
        const nextRevision = await this.deps.write(uid, revision, payload);
        if (generation !== this.generation) return;
        this.revision = nextRevision;
        this.baseline = serialized;
        this.dirty = this.latest !== serialized;
        if (this.dirty) {
          this.stage(); // The queued edit now starts from the newly committed revision.
        } else {
          this.deps.clear(uid);
          this.deps.report("saved");
        }
      } catch (error) {
        if (generation !== this.generation) return;
        if (error instanceof CloudConflictError) {
          this.conflict = true;
          this.conflictBaseRevision = this.revision;
          this.deps.report("conflict", error);
        } else {
          this.deps.report("error", error);
        }
      }
    })();
    this.inFlight = task;
    await task;
    if (this.inFlight === task) this.inFlight = null;
    if (generation === this.generation && this.dirty && !this.conflict && this.latest !== serialized) this.schedule();
  }

  async waitForWrite(timeoutMs?: number) {
    if (!this.inFlight) return true;
    if (!timeoutMs) {
      await this.inFlight;
      return true;
    }
    return Promise.race([
      this.inFlight.then(() => true),
      new Promise<boolean>(resolve => setTimeout(() => resolve(false), timeoutMs)),
    ]);
  }
}
