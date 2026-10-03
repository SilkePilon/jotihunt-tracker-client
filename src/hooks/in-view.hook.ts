import { useEffect, useState, type RefObject } from 'react';

/**
 * Whether the element has been scrolled into view (also inside scrolling containers) at least once; stays true afterwards,
 * so e.g. a lazily loaded image isn't fetched again when it scrolls out and back in.
 * Without IntersectionObserver support the element counts as visible.
 */
export function useInViewOnce(ref: RefObject<Element | null>, rootMargin = '100px'): boolean {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const element = ref.current;
    if (seen || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setSeen(true);
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rootMargin, seen]);

  return seen;
}
