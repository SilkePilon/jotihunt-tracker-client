import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { animate, motion, useTransform } from 'motion/react';
import { computeSnapHeights, nextSnap, rubberBand, settleSnap, type SnapHeights } from '@/lib/sheet-snaps';
import useSidebarStore from '@/stores/sidebar.store';
import useViewportStore from '@/stores/viewport.store';
import { tourTarget } from '@/components/tour/targets';
import { sheetVisibleHeight } from './sheet-motion';

const GRAB = 24;
const SPRING = { type: 'spring', bounce: 0, visualDuration: 0.35 } as const;

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  startH: number;
  lastY: number;
  lastT: number;
  velocity: number;
  moved: boolean;
  fromGrab: boolean;
  /** Nearest scroller around the pointerdown target inside the body (null when started on the grab/peek) */
  scroller: HTMLElement | null;
}

/** Nearest vertically scrollable element from `target` up to and including `body`; `body` when none scrolls. */
function scrollerFor(target: Node, body: HTMLElement): HTMLElement {
  for (let el: HTMLElement | null = target instanceof HTMLElement ? target : target.parentElement; el; el = el.parentElement) {
    if (el.scrollHeight > el.clientHeight) {
      const overflow = getComputedStyle(el).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') return el;
    }
    if (el === body) break;
  }
  return body;
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
  const setSheetSnapHeights = useSidebarStore((s) => s.setSheetSnapHeights);
  const { visibleH, safeTop, safeBottom, keyboard } = useViewportStore(
    useShallow((s) => ({ visibleH: s.visibleH, safeTop: s.safeTop, safeBottom: s.safeBottom, keyboard: s.keyboard })),
  );
  const peekRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [peekContent, setPeekContent] = useState(136);
  const drag = useRef<Drag | null>(null);
  // Height the content column keeps while the sheet is dragged or springing down; it shrinks to the settled height
  // only once the collapse finishes, so content never vanishes mid-gesture. Growing uses the settled height at once.
  const [layoutHeight, setLayoutHeight] = useState(0);
  const animId = useRef(0);

  const springTo = useCallback((target: number) => {
    const id = ++animId.current;
    const controls = animate(sheetVisibleHeight, target, SPRING);
    controls.then(() => {
      if (animId.current === id) setLayoutHeight(target);
    });
    return controls;
  }, []);

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
  useEffect(() => setSheetSnapHeights(heights), [heights, setSheetSnapHeights]);
  useEffect(() => () => setSheetSnapHeights(null), [setSheetSnapHeights]);
  // A keyboard opened for an input in the sheet: give it all the room (not for inputs elsewhere, e.g. a drawer)
  useEffect(() => {
    if (keyboard > 0 && snap !== 'full' && sheetRef.current?.contains(document.activeElement)) setSnap('full');
  }, [keyboard, snap, setSnap]);

  const settled = heights[snap];
  useEffect(() => {
    const controls = springTo(settled);
    setSheetHeight(settled);
    return () => controls.stop();
  }, [settled, setSheetHeight, springTo]);
  useEffect(() => () => setSheetHeight(0), [setSheetHeight]);

  const y = useTransform(sheetVisibleHeight, (h) => heights.full - h);
  const columnHeight = Math.min(heights.full, Math.max(settled, layoutHeight)) - safeBottom;

  // A pull down from the body at scrollTop 0 is a sheet drag: stop the browser from claiming it as a pan (which would
  // fire pointercancel). Upward and inner scrolling stay untouched.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    let startX = 0;
    let startY = 0;
    const onTouchStart = (event: TouchEvent) => {
      startX = event.touches[0]?.clientX ?? 0;
      startY = event.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      const d = drag.current;
      if (!d || d.fromGrab || !event.cancelable) return;
      if (d.moved) {
        event.preventDefault();
        return;
      }
      // Only a mostly-vertical downward pull with its scroller at the top; sideways (chip rows, sliders, selection) stays native
      const dx = (event.touches[0]?.clientX ?? startX) - startX;
      const dy = (event.touches[0]?.clientY ?? startY) - startY;
      if (dy > 0 && Math.abs(dy) > Math.abs(dx) && (d.scroller?.scrollTop ?? 0) <= 0) event.preventDefault();
    };
    body.addEventListener('touchstart', onTouchStart, { passive: true });
    body.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      body.removeEventListener('touchstart', onTouchStart);
      body.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  function onPointerDown(event: React.PointerEvent) {
    // React bubbles events through portals: ignore dialogs rendered from the sheet's children
    if (!(event.currentTarget as Node).contains(event.target as Node)) return;
    // A second finger while dragging does not restart the drag
    if (drag.current) return;
    const body = bodyRef.current;
    const inBody = !!body && body.contains(event.target as Node);
    const scroller = inBody ? scrollerFor(event.target as Node, body) : null;
    if (scroller && scroller.scrollTop > 0) return;
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startH: sheetVisibleHeight.get(),
      lastY: event.clientY,
      lastT: performance.now(),
      velocity: 0,
      moved: false,
      fromGrab: !inBody,
      scroller,
    };
  }

  function onPointerMove(event: React.PointerEvent) {
    const d = drag.current;
    if (!d || event.pointerId !== d.pointerId) return;
    const now = performance.now();
    // Positive velocity = sheet growing = finger moving up
    d.velocity = (d.lastY - event.clientY) / Math.max(1, now - d.lastT);
    d.lastY = event.clientY;
    d.lastT = now;
    let dy = event.clientY - d.startY;
    if (!d.moved) {
      const dx = event.clientX - d.startX;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
      // Sideways wins: chip rows, range inputs, text selection keep the gesture
      if (Math.abs(dx) >= Math.abs(dy)) {
        drag.current = null;
        return;
      }
      // From the body only a downward pull with its scroller at the top moves the sheet; anything else is a scroll
      if (!d.fromGrab && (dy < 0 || (d.scroller?.scrollTop ?? 0) > 0)) {
        drag.current = null;
        return;
      }
      d.moved = true;
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      // Grab the sheet where it is now: stop any running spring and start the drag from here, without a jump
      animId.current++;
      sheetVisibleHeight.stop();
      d.startH = sheetVisibleHeight.get();
      d.startY = event.clientY;
      dy = 0;
      setLayoutHeight(heights.full);
    }
    sheetVisibleHeight.set(rubberBand(d.startH - dy, heights.peek, heights.full));
  }

  // pointerup and pointercancel both end here, so a cancelled drag still settles on a snap
  function onPointerEnd(event: React.PointerEvent) {
    const d = drag.current;
    if (!d || event.pointerId !== d.pointerId) return;
    drag.current = null;
    // Taps: the grab <button> cycles snaps itself; taps in the peek/body are normal clicks
    if (!d.moved) return;
    const target = settleSnap(sheetVisibleHeight.get(), d.velocity, heights);
    if (target === snap) springTo(heights[target]);
    else setSnap(target);
  }

  return (
    <motion.div
      ref={sheetRef}
      {...tourTarget('sidebar.root')}
      role="region"
      aria-label="Zijbalk"
      className="fixed inset-x-0 bottom-0 z-40 flex select-none flex-col rounded-t-3xl bg-beheer-window shadow-[0_-6px_30px_rgb(0_0_0/.25)] [-webkit-touch-callout:none] [&_input]:select-text [&_textarea]:select-text"
      style={{ height: heights.full, y, marginBottom: keyboard, paddingBottom: 'env(safe-area-inset-bottom)' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      {/* Fills the gap below the sheet when it is rubber-banded above full */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-full h-[50vh] bg-beheer-window" />
      <div className="flex shrink-0 flex-col" style={{ height: columnHeight }}>
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
