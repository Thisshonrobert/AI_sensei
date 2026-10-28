export const IDLE_GAP_MS: number;
export const MAX_ACTIVE_MS: number;
export function sessionElapsedMs(session: {status:string; elapsedActiveMs?:number|null; activeSince?:Date|null}, now: Date): number;
export function hasIdleGap(session: {status:string; activeSince?:Date|null}, now: Date): boolean;
