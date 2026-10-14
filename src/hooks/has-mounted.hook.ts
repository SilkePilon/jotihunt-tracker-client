import { useEffect, useState } from 'react';

/** False on the first render, true from the next frame on (e.g. to skip an entrance animation on first paint) */
export function useHasMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return mounted;
}
