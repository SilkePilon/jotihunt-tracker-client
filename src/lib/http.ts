/** A request that hangs longer than this fails, so a dead socket can't stall polling forever (SWR dedupes on the pending one). */
export const REQUEST_TIMEOUT_MS = 15_000;
/** For calls that legitimately take long server-side (edition switch, upstream reload, push fan-out). */
export const SLOW_REQUEST_TIMEOUT_MS = 60_000;
