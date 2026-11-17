import { useLayoutEffect, useState } from 'react';

/**
 * The element's content-box width, kept up to date with a ResizeObserver (undefined until mounted). Measured in a
 * layout effect, so a layout picked from it is right on the first paint. Pass the element from a callback ref.
 */
export function useElementWidth(element: HTMLElement | null): number | undefined {
  const [measured, setMeasured] = useState<{ element: HTMLElement; width: number }>();
  useLayoutEffect(() => {
    if (!element) return;
    const measure = () => setMeasured({ element, width: element.clientWidth });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  // A width measured on an element that has since unmounted doesn't count
  return measured?.element === element ? measured.width : undefined;
}
