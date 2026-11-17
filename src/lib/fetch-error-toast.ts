import {isNetworkError} from '@/lib/api-error';

/** Not again within this time after the last error toast, when the connection flaps */
export const ERROR_TOAST_COOLDOWN_MS = 60_000;
/**
 * A failing key that has not failed again for this long is forgotten (its component unmounted, so it never succeeds
 * again). Longer than every poll interval, so a key that keeps failing is never forgotten while it polls.
 */
export const FAILING_KEY_STALE_MS = 5 * 60_000;
/** A key that failed once may be a blip: the toast waits for its second failure, or until it has failed this long */
export const ERROR_TOAST_DELAY_MS = 15_000;

/** How a failure counts for the toast */
export interface FetchErrorOptions {
    /**
     * Leave it to the stale-data badge: a pure network error on a phone, where the badge already says the data is
     * old and a toast would cover the sheet. The key still counts as failing (for "Opnieuw" and for ending the outage).
     */
    quiet?: boolean;
}

interface FailingKey {
    first: number;
    last: number;
    count: number;
    quiet: boolean;
}

/**
 * Decides when the "fetch failed" toast shows and clears. An outage lasts while one or more SWR keys keep failing;
 * it shows the toast at most once, and only the success of the failing keys themselves ends it (another endpoint
 * working says nothing about the failing one). A new outage after that shows a new toast, but not within a minute
 * of the previous one. A single failure is not an outage yet: the toast waits until a key failed twice or has been
 * failing for 15 s (see `due`), and quiet failures (phones, network errors: the stale badge) never show it.
 */
export function createFetchErrorToastState() {
    /** Failing keys: when they first and last failed, how often, and whether the last failure was quiet */
    const failing = new Map<string, FailingKey>();
    let shownThisOutage = false;
    let lastShownAt = -Infinity;

    function pruneStale(now: number) {
        for (const [key, entry] of failing) if (now - entry.last > FAILING_KEY_STALE_MS) failing.delete(key);
    }

    /** Show the toast now if a loud key has failed long or often enough, outside the cooldown and not shown yet */
    function tryShow(now: number): boolean {
        if (shownThisOutage || now - lastShownAt < ERROR_TOAST_COOLDOWN_MS) return false;
        pruneStale(now);
        const ripe = [...failing.values()].some((entry) => !entry.quiet && (entry.count >= 2 || now - entry.first >= ERROR_TOAST_DELAY_MS));
        if (!ripe) return false;
        shownThisOutage = true;
        lastShownAt = now;
        return true;
    }

    return {
        /** A key failed (not for a 401). Returns whether to show the toast now. */
        error(key: string, now = Date.now(), {quiet = false}: FetchErrorOptions = {}): boolean {
            const entry = failing.get(key);
            failing.set(key, {first: entry?.first ?? now, last: now, count: (entry?.count ?? 0) + 1, quiet});
            return tryShow(now);
        },
        /**
         * For a timer ERROR_TOAST_DELAY_MS after a first failure that did not show the toast: whether to show it now
         * (the key is still failing and has not answered in between).
         */
        due(now = Date.now()): boolean {
            return tryShow(now);
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
        /** The keys that are failing now (what "Opnieuw" refetches), stale ones left out */
        failingKeys(now = Date.now()): string[] {
            pruneStale(now);
            return [...failing.keys()];
        },
        /** Whether this outage's toast is up */
        showing(): boolean {
            return shownThisOutage;
        },
    };
}

/** The fetch-error toast's Dutch copy; the technical details go to the console (and Sentry), not to the user. */
export function fetchErrorToastText(error: unknown): {title: string; description: string} {
    if (isNetworkError(error)) {
        return {title: 'Geen verbinding met de server', description: 'Controleer je verbinding. We proberen het automatisch opnieuw.'};
    }
    return {title: 'Gegevens laden mislukt', description: 'De server gaf een fout. We proberen het automatisch opnieuw.'};
}
