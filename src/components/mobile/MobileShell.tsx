import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useTransform } from 'motion/react';
import type { MapRef } from '@/components/Map';
import { useViewportInsets } from '@/hooks/viewport-insets.hook';
import { useBackEntry } from '@/hooks/back-entry.hook';
import useSidebarStore from '@/stores/sidebar.store';
import useMobileNavStore from '@/stores/mobile-nav.store';
import { PANE_SLIDE, PANE_SLIDE_TRANSITION } from '@/lib/motion';
import type { SnapHeights } from '@/lib/sheet-snaps';
import BottomSheet from './BottomSheet';
import PeekStrip from './PeekStrip';
import MobileMenu from './MobileMenu';
import MobilePage from './MobilePage';
import HuntMarkerButton from './HuntMarkerButton';
import ViewportDebug from './ViewportDebug';
import { DOCK_ID } from './DockedPopup';
import { sheetVisibleHeight } from './sheet-motion';

/** Lowers the sheet on Back. Rendered before the page entries so its history entry sits below theirs. */
function SheetBackEntry() {
  const snap = useSidebarStore((s) => s.sheetSnap);
  const setSnap = useSidebarStore((s) => s.setSheetSnap);
  useBackEntry('sheet', snap !== 'peek', () => setSnap('peek'));
  return null;
}

/** Back entries per pushed page, newest last (Back pops the newest page). */
function PageBackEntry({ depth }: { depth: number }) {
  const pop = useMobileNavStore((s) => s.pop);
  useBackEntry(`page:${depth}`, true, pop);
  return null;
}

/**
 * Menu and pages share the sheet's one scroller. On every view change: remember the old view's scroll, start a
 * pushed page at the top, give a view you return to its old scroll back, and shift the leaving view (popLayout made
 * it absolute) by the same jump so it slides out from where it was.
 */
function useViewScroll(containerRef: RefObject<HTMLDivElement | null>, depth: number, viewKey: string) {
  const scrolls = useRef<number[]>([]);
  const prev = useRef({ depth, viewKey });
  useLayoutEffect(() => {
    const { depth: prevDepth, viewKey: prevKey } = prev.current;
    if (prevKey === viewKey) return;
    prev.current = { depth, viewKey };
    const container = containerRef.current;
    const body = container?.closest<HTMLElement>('[data-sheet-body]');
    if (!container || !body) return;
    const from = body.scrollTop;
    scrolls.current[prevDepth] = from;
    const to = depth < prevDepth ? (scrolls.current[depth] ?? 0) : 0;
    scrolls.current.length = depth + 1;
    body.scrollTop = to;
    const leaving = container.querySelector<HTMLElement>(`[data-view="${CSS.escape(prevKey)}"]`);
    // Read the clamped value back: a short view may not reach the saved offset
    if (leaving) leaving.style.translate = `0 ${body.scrollTop - from}px`;
  }, [containerRef, depth, viewKey]);
}

/** Phones: the bottom sheet (peek strip + menu/page stack), camera button and popup dock. */
export default function MobileShell({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  useViewportInsets();
  const { stack, direction } = useMobileNavStore();
  const [heights, setHeights] = useState<SnapHeights>({ peek: 0, half: 0, full: 0 });
  const dockBottom = useTransform(sheetVisibleHeight, (h) => h + 10);
  const top = stack[stack.length - 1];
  const viewKey = top ? `${stack.length}:${top.id}` : 'menu';
  const viewsRef = useRef<HTMLDivElement>(null);
  useViewScroll(viewsRef, stack.length, viewKey);
  // Leaving phone width unmounts the shell; the next phone visit starts at the menu
  useEffect(() => () => useMobileNavStore.getState().reset(), []);

  return (
    <>
      <ViewportDebug snaps={heights} />
      <motion.div id={DOCK_ID} className="pointer-events-none fixed inset-x-3 z-[45] flex flex-col gap-2" style={{ bottom: dockBottom }} />
      <HuntMarkerButton />
      <BottomSheet peek={<PeekStrip />} onHeights={setHeights}>
        {/* Effects run in sibling order: the sheet entry first, so Back closes pages before lowering the sheet */}
        <SheetBackEntry />
        {stack.map((page, i) => (
          <PageBackEntry key={`${i}:${page.id}`} depth={i + 1} />
        ))}
        {/* Positioned, so popLayout measures the leaving view inside the scroller */}
        <div ref={viewsRef} className="relative">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div key={viewKey} data-view={viewKey} custom={direction} variants={PANE_SLIDE} initial="enter" animate="center" exit="exit" transition={PANE_SLIDE_TRANSITION}>
              {top ? <MobilePage page={top} mapRef={mapRef} /> : <MobileMenu />}
            </motion.div>
          </AnimatePresence>
        </div>
      </BottomSheet>
    </>
  );
}
