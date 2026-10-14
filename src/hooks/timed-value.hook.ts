import { useCallback, useEffect, useState } from 'react';

/**
 * A value that clears itself `ms` after it was last set, e.g. the id of the invite whose copy button shows a check.
 * Setting it again (also to the same value) restarts the timer.
 * @returns [value or null, set, clear]
 */
export function useTimedValue<T>(ms: number): [T | null, (value: T) => void, () => void] {
  const [state, setState] = useState<{ value: T | null; round: number }>({ value: null, round: 0 });

  useEffect(() => {
    if (state.value === null) return;
    const timeout = setTimeout(() => setState((current) => ({ value: null, round: current.round })), ms);
    return () => clearTimeout(timeout);
  }, [state, ms]);

  const set = useCallback((value: T) => setState((current) => ({ value, round: current.round + 1 })), []);
  const clear = useCallback(() => setState((current) => ({ value: null, round: current.round })), []);
  return [state.value, set, clear];
}
