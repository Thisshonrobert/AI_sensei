// Active study time is segmented: accumulated elapsed time plus at most one open
// segment. A closed laptop or abandoned tab must never turn wall-clock days into
// "active minutes", so an open segment older than IDLE_GAP_MS contributes nothing
// until resumeSession starts a new segment.
export const IDLE_GAP_MS = 15 * 60 * 1000;
export const MAX_ACTIVE_MS = 2147483647;

export function sessionElapsedMs(session, now) {
  const saved = Math.min(MAX_ACTIVE_MS, Math.max(0, Number(session.elapsedActiveMs) || 0));
  if (session.status !== 'active' || !session.activeSince) return saved;
  const gap = Math.max(0, now.getTime() - session.activeSince.getTime());
  if (gap > IDLE_GAP_MS) return saved;
  return Math.min(MAX_ACTIVE_MS, saved + gap);
}

export function hasIdleGap(session, now) {
  if (session.status !== 'active' || !session.activeSince) return false;
  return now.getTime() - session.activeSince.getTime() > IDLE_GAP_MS;
}
