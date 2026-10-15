import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useTransform } from 'motion/react';
import { computeSnapHeights, nextSnap, rubberBand, settleSnap, type SnapHeights } from '@/lib/sheet-snaps';
import useSidebarStore from '@/stores/sidebar.store';
import useViewportStore from '@/stores/viewport.store';
import { tourTarget } from '@/components/tour/targets';
import { sheetVisibleHeight } from './sheet-motion';

const GRAB = 24;
const SPRING = { type: 'spring', bounce: 0, visualDuration: 0.35 } as const;

interface Drag {
  startY: number;
  startH: number;
  lastY: number;
  lastT: number;
  velocity: number;
  moved: boolean;
  pointerId?: number;
  fromGrab: boolean;
}

/**
 * The phone sheet: fixed to bottom:0 (above bottom browser toolbars), moved only with translateY, three snaps.
 * Drag from the grab/peek area; drag down from the body only when it is scrolled to the top. The body's height
 * follows the settled snap, so content scrolls at every height.
 */
export default function BottomSheet({ peek, children, onHeights }: { peek: ReactNode; children: ReactNode; onHeights?: (h: SnapHeights) => void }) {
  const snap = useSidebarStore((s) => s.sheetSnap);
  const setSnap = useSidebarStore((s) => s.setSheetSnap);
  const setSheetHeight = useSidebarStore((s) => s.setSheetHeight);
  const { visibleH, safeTop, safeBottom, keyboard } = useViewportStore();
  const peekRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [peekContent, setPeekContent] = useState(136);
  const drag = useRef<Drag | null>(null);

  // Peek height = grab + measured peek strip
  useLayoutEffect(() => {
    const el = peekRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setPeekContent(GRAB + el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const heights = useMemo(() => computeSnapHeights({ visibleH, safeTop, safeBottom, peekContent }), [visibleH, safeTop, safeBottom, peekContent]);
  useEffect(() => onHeights?.(heights), [heights, onHeights]);
  // An open keyboard means an input in the sheet has focus: give it all the room
  useEffect(() => {
    if (keyboard > 0 && snap !== 'full') setSnap('full');
  }, [keyboard, snap, setSnap]);

  const settled = heights[snap];
  useEffect(() => {
    const controls = animate(sheetVisibleHeight, settled, SPRING);
    setSheetHeight(settled);
    return () => controls.stop();
  }, [settled, setSheetHeight]);
  useEffect(() => () => setSheetHeight(0), [setSheetHeight]);

  const y = useTransform(sheetVisibleHeight, (h) => heights.full - h);

  function onPointerDown(event: React.PointerEvent) {
    const body = bodyRef.current;
    const inBody = !!body && body.contains(event.target as Node);
    if (inBody && body.scrollTop > 0) return;
    drag.current = { startY: event.clientY, startH: sheetVisibleHeight.get(), lastY: event.clientY, lastT: performance.now(), velocity: 0, moved: false, pointerId: event.pointerId, fromGrab: !inBody };
  }

  function onPointerMove(event: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const now = performance.now();
    // Positive velocity = sheet growing = finger moving up
    d.velocity = (d.lastY - event.clientY) / Math.max(1, now - d.lastT);
    d.lastY = event.clientY;
    d.lastT = now;
    const dy = event.clientY - d.startY;
    if (!d.moved) {
      if (Math.abs(dy) < 6) return;
      // From the body only a downward pull at scrollTop 0 moves the sheet; anything else is a scroll
      if (!d.fromGrab && (dy < 0 || (bodyRef.current?.scrollTop ?? 0) > 0)) {
        drag.current = null;
        return;
      }
      d.moved = true;
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }
    sheetVisibleHeight.set(rubberBand(d.startH - dy, heights.peek, heights.full));
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    // Taps: the grab <button> cycles snaps itself; taps in the peek/body are normal clicks
    if (!d.moved) return;
    const target = settleSnap(sheetVisibleHeight.get(), d.velocity, heights);
    if (target === snap) animate(sheetVisibleHeight, heights[target], SPRING);
    else setSnap(target);
  }

  return (
    <motion.div
      {...tourTarget('sidebar.root')}
      role="region"
      aria-label="Zijbalk"
      className="fixed inset-x-0 bottom-0 z-40 flex select-none flex-col rounded-t-3xl bg-beheer-window shadow-[0_-6px_30px_rgb(0_0_0/.25)] [-webkit-touch-callout:none] [&_input]:select-text [&_textarea]:select-text"
      style={{ height: heights.full, y, marginBottom: keyboard, paddingBottom: 'env(safe-area-inset-bottom)' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (drag.current = null)}
    >
      <div className="flex shrink-0 flex-col" style={{ height: settled - safeBottom }}>
        <button
          type="button"
          aria-label="Zijbalk groter of kleiner maken"
          onClick={() => setSnap(nextSnap(snap))}
          className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center"
        >
          <span className="h-[5px] w-9 rounded-full bg-muted-foreground/50" />
        </button>
        <div ref={peekRef} className="shrink-0 touch-none">
          {peek}
        </div>
        <div ref={bodyRef} data-sheet-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
      </div>
    </motion.div>
  );
}
