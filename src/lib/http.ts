/** A request that hangs longer than this fails, so a dead socket can't stall polling forever (SWR dedupes on the pending one). */
export const REQUEST_TIMEOUT_MS = 15_000;
/** For calls that legitimately take long server-side (edition switch, upstream reload, push fan-out). */
export const SLOW_REQUEST_TIMEOUT_MS = 60_000;
/**
 * The fresh list that checks whether a save without an answer landed anyway: short, so a dead connection doesn't keep
 * the Hunt/Spot dialog or the hint form busy for a second full {@link REQUEST_TIMEOUT_MS} (the save already waited that long).
 */
export const CONFIRM_REQUEST_TIMEOUT_MS = 6_000;
