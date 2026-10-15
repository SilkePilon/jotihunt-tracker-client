import { type RefObject, createContext, useEffect, useLayoutEffect, useRef } from 'react';

/** The chat thread's scroller, so cards inside (MiniMap) measure "near the visible part" against it, not the viewport */
export const ChatScrollerContext = createContext<RefObject<HTMLDivElement | null> | undefined>(undefined);

/** Within this many px of the bottom counts as "at the bottom" */
const STICK_SLACK_PX = 40;

/**
 * Keeps a scroller at its bottom while its content grows (streaming), unless the user scrolled up to read; a change of
 * `pinKey` (the newest user message) pins it to the bottom again.
 */
export function useStickToBottom(pinKey: unknown) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stuck = useRef(true);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    scroller.scrollTop = scroller.scrollHeight;
    const observer = new ResizeObserver(() => {
      if (stuck.current) scroller.scrollTop = scroller.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    stuck.current = true;
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [pinKey]);

  function onScroll() {
    const scroller = scrollerRef.current;
    if (scroller) stuck.current = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < STICK_SLACK_PX;
  }

  return { scrollerRef, contentRef, onScroll };
}
