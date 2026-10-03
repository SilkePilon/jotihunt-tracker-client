import { useEffect, useRef } from 'react';

/**
 * Hook to run a function every `delay` milliseconds (the latest callback is used; null pauses it)
 * @param callback The function to run
 * @param delay The delay in milliseconds, or null to stop
 */
function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    function tick() {
      if (savedCallback.current) {
        savedCallback.current();
      }
    }
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

export default useInterval;
