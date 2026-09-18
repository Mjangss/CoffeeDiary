export const nextTimerElapsed = (timestamp: number, startedAt: number, durationMs: number) =>
  Math.min(Math.max(0, timestamp - startedAt), durationMs);
