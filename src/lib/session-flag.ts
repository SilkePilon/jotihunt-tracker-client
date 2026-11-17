/**
 * A '1' flag in sessionStorage that never throws: blocked site data (a SecurityError on merely touching
 * window.sessionStorage) or a full quota reads as "not set" and skips the write.
 */
type FlagStorage = Pick<Storage, 'getItem' | 'setItem'>;

function sessionStore(): FlagStorage | undefined {
  try {
    return typeof sessionStorage === 'undefined' ? undefined : sessionStorage;
  } catch {
    return undefined;
  }
}

/** Whether `key` was set earlier in this tab (false when storage is unavailable). */
export function readSessionFlag(key: string, storage: FlagStorage | undefined = sessionStore()): boolean {
  try {
    return storage?.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** Set `key` for this tab; without storage the flag is simply forgotten. */
export function writeSessionFlag(key: string, storage: FlagStorage | undefined = sessionStore()): void {
  try {
    storage?.setItem(key, '1');
  } catch {
    // Private mode / blocked storage: nothing to remember it in
  }
}
