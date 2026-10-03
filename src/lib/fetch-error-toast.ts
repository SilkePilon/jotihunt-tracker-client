/** Not again within this time after the last error toast, when the connection flaps */
export const ERROR_TOAST_COOLDOWN_MS = 60_000;
/**
 * A failing key that has not failed again for this long is forgotten (its component unmounted, so it never succeeds
 * again). Longer than every poll interval, so a key that keeps failing is never forgotten while it polls.
 */
export const FAILING_KEY_STALE_MS = 5 * 60_000;

/**
 * Decides when the "fetch failed" toast shows and clears. An outage lasts while one or more SWR keys keep failing;
 * it shows the toast at most once, and only the success of the failing keys themselves ends it (another endpoint
 * working says nothing about the failing one). A new outage after that shows a new toast, but not within a minute
 * of the previous one.
 */
export function createFetchErrorToastState() {
    /** Failing keys and when they last failed */
    const failing = new Map<string, number>();
    let shownThisOutage = false;
    let lastShownAt = -Infinity;

    function pruneStale(now: number) {
        for (const [key, at] of failing) if (now - at > FAILING_KEY_STALE_MS) failing.delete(key);
    }

    return {
        /** A key failed (not for a 401). Returns whether to show the toast now. */
        error(key: string, now = Date.now()): boolean {
            failing.set(key, now);
            if (shownThisOutage || now - lastShownAt < ERROR_TOAST_COOLDOWN_MS) return false;
            shownThisOutage = true;
            lastShownAt = now;
            return true;
        },
        /** A key loaded. Returns whether to dismiss the toast now (the outage is over). */
        success(key: string, now = Date.now()): boolean {
            if (failing.size === 0) return false;
            failing.delete(key);
            pruneStale(now);
            if (failing.size > 0) return false;
            const wasShown = shownThisOutage;
            shownThisOutage = false;
            return wasShown;
        },
    };
}
