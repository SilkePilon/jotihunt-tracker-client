/**
 * One request at a time: `run(kind, action)` starts `action` only when nothing else is pending and reports which kind
 * runs (and null once it settled, also when it threw). Resolves to undefined when refused. Plain state, not React state,
 * so a double tap within one render can not slip through.
 */
export function createPendingGuard<Kind extends string>(onChange: (kind: Kind | null) => void) {
  let current: Kind | null = null;
  return async function run<T>(kind: Kind, action: () => Promise<T>): Promise<T | undefined> {
    if (current) return undefined;
    current = kind;
    onChange(kind);
    try {
      return await action();
    } finally {
      current = null;
      onChange(null);
    }
  };
}
