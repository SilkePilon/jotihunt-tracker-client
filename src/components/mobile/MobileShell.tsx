import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import type { MapRef } from '@/components/Map';
import { useViewportInsets } from '@/hooks/viewport-insets.hook';
import { useBackEntry } from '@/hooks/back-entry.hook';
import { useHasMounted } from '@/hooks/has-mounted.hook';
import { useLandscapePhone } from '@/hooks/media.hook';
import ViewFocus from '@/components/motion/ViewFocus';
import useSidebarStore from '@/stores/sidebar.store';
import useMobileNavStore from '@/stores/mobile-nav.store';
import { LAYOUT_SPRING, PANE_SLIDE, PANE_SLIDE_TRANSITION } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { DOCK_GAP, dockCardMax, type SnapHeights } from '@/lib/sheet-snaps';
import { useDockRow } from '@/hooks/dock-row.hook';
import useViewportStore from '@/stores/viewport.store';
import BottomSheet from './BottomSheet';
import PeekStrip from './PeekStrip';
import MyLocationButton from './MyLocationButton';
import ResetNorthButton from './ResetNorthButton';
import ZoomButtons from './ZoomButtons';
import MobileMenu from './MobileMenu';
import SearchDrawer from './SearchDrawer';
import MobilePage from './MobilePage';
import ViewportDebug from './ViewportDebug';
import { DOCK_CARD_MAX_VAR, DOCK_ID } from './DockedPopup';
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
    const views = (key: string) => container.querySelectorAll<HTMLElement>(`[data-view="${CSS.escape(key)}"]`);
    // A view that comes back while still exiting is revived as the same node: drop the offset it left with
    views(viewKey).forEach((node) => node.style.removeProperty('translate'));
    // Read the clamped value back: a short view may not reach the saved offset
    const shift = `0 ${body.scrollTop - from}px`;
    views(prevKey).forEach((node) => {
      node.style.translate = shift;
    });
  }, [containerRef, depth, viewKey]);
}

/**
 * The popup dock just above the sheet: the map tiles and a docked card. With room above the sheet the tiles stack
 * above the card; with little room (half snap, short or sideways phones) the card stands beside them (useDockRow). The card never grows past the room left above the sheet (it scrolls inside).
 * A phone held sideways has the sheet as a left column: the dock then stands on the bottom edge, right of it.
 */
function useDockLayout(tilesRef: RefObject<HTMLDivElement | null>) {
  const { visibleH, safeTop, safeBottom } = useViewportStore(useShallow((s) => ({ visibleH: s.visibleH, safeTop: s.safeTop, safeBottom: s.safeBottom })));
  const row = useDockRow();
  const sideways = useLandscapePhone();
  const sheetSide = useSidebarStore((s) => s.sheetSide);
  // What the dock stands on: the sheet (-1: follow its live height), or the safe area at the bottom edge when sideways
  const sidewaysBase = useMotionValue(-1);
  useEffect(() => sidewaysBase.set(sideways ? safeBottom : -1), [sidewaysBase, sideways, safeBottom]);
  const base = useTransform([sheetVisibleHeight, sidewaysBase], ([sheet, side]: number[]) => (side >= 0 ? side : sheet));
  // Height the tiles take above the card (none in the row layout, where they stand beside it)
  const tilesAbove = useMotionValue(0);
  // Height above the sheet that isn't the safe area
  const room = useMotionValue(visibleH - safeTop);
  useEffect(() => room.set(visibleH - safeTop), [room, visibleH, safeTop]);
  useLayoutEffect(() => {
    const tiles = tilesRef.current;
    if (!tiles) return;
    const measure = () => tilesAbove.set(row ? 0 : tiles.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(tiles);
    return () => observer.disconnect();
  }, [tilesRef, tilesAbove, row]);
  const bottom = useTransform(base, (h) => h + DOCK_GAP);
  const cardMax = useTransform([base, tilesAbove, room], ([sheet, tiles, height]: number[]) => `${dockCardMax({ visibleH: height, sheet, safeTop: 0, tiles })}px`);
  return { row, style: { bottom, [DOCK_CARD_MAX_VAR]: cardMax, ...(sideways && sheetSide > 0 && { left: sheetSide + DOCK_GAP }) } };
}

/** Phones: the bottom sheet (peek strip + menu/page stack), camera button and popup dock. */
export default function MobileShell({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  useViewportInsets();
  const { stack, direction } = useMobileNavStore();
  const [heights, setHeights] = useState<SnapHeights>({ peek: 0, half: 0, full: 0 });
  const tilesRef = useRef<HTMLDivElement>(null);
  const dock = useDockLayout(tilesRef);
  const top = stack[stack.length - 1];
  const viewKey = top ? `${stack.length}:${top.id}` : 'menu';
  const viewsRef = useRef<HTMLDivElement>(null);
  useViewScroll(viewsRef, stack.length, viewKey);
  // The page on top until this render: a pop back to the menu puts focus on the row that opened it. Effects run
  // child-first, so the arriving view still reads the previous top here.
  const leftRef = useRef<string | null>(null);
  useEffect(() => {
    leftRef.current = top?.id ?? null;
  }, [top]);
  const mounted = useHasMounted();
  const [searchOpen, setSearchOpen] = useState(false);
  // Leaving phone width unmounts the shell; the next phone visit starts at the menu
  useEffect(() => () => useMobileNavStore.getState().reset(), []);

  return (
    <>
      <ViewportDebug snaps={heights} />
      <motion.div
        id={DOCK_ID}
        data-dock={dock.row ? 'row' : 'column'}
        className={cn('pointer-events-none fixed right-[max(0.75rem,env(safe-area-inset-right))] left-[max(0.75rem,env(safe-area-inset-left))] z-[45] flex gap-2', dock.row ? 'flex-row-reverse items-end' : 'flex-col')}
        style={dock.style}
      >
        {/* Always the dock's first node: popups portal in after it, under the tiles (column) or left of them (row) */}
        {/* Slides to its new place when the dock turns between row and column (only then: layoutDependency) */}
        <motion.div ref={tilesRef} layout="position" layoutDependency={dock.row} transition={{ layout: LAYOUT_SPRING }} className="flex shrink-0 flex-col gap-2">
          {/* Bottom to top: Mijn locatie, zoom + and −, and the reset tile while the map is turned or tilted (like the desktop stack) */}
          <ResetNorthButton mapRef={mapRef} />
          <ZoomButtons mapRef={mapRef} />
          <MyLocationButton mapRef={mapRef} />
        </motion.div>
      </motion.div>
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
              <ViewFocus enabled={mounted} target={(root) => (top ? root.querySelector('[data-view-back]') : root.querySelector(`[data-nav-id="${leftRef.current}"]`))}>
                {top ? <MobilePage page={top} depth={stack.length} mapRef={mapRef} /> : <MobileMenu onSearch={() => setSearchOpen(true)} />}
              </ViewFocus>
            </motion.div>
          </AnimatePresence>
        </div>
      </BottomSheet>
      <SearchDrawer mapRef={mapRef} open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
