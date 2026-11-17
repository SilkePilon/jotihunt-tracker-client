import { useLayoutEffect, useState } from 'react';

/**
 * The element's inner width (clientWidth: content plus padding, no border or scrollbar), kept up to date with a
 * ResizeObserver (undefined until mounted). Measured in a layout effect, so a layout picked from it is right on the
 * first paint. Only a width change re-renders (not a height-only resize). Pass the element from a callback ref.
 */
export function useElementWidth(element: HTMLElement | null): number | undefined {
  const [measured, setMeasured] = useState<{ element: HTMLElement; width: number }>();
  useLayoutEffect(() => {
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth;
      setMeasured((previous) => (previous?.element === element && previous.width === width ? previous : { element, width }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  // A width measured on an element that has since unmounted doesn't count
  return measured?.element === element ? measured.width : undefined;
}
