import { type ReactNode, type RefObject, type TouchEvent, useEffect, useRef } from 'react';
import { animate, motion, useIsPresent, useMotionValue, useReducedMotion } from 'motion/react';
import { ChevronLeftIcon } from 'lucide-react';
import type { MapRef } from '@/components/Map';
import type { MobilePage as Page } from '@/lib/mobile-nav';
import useMobileNavStore from '@/stores/mobile-nav.store';
import SidebarSections from '@/components/sidebar/SidebarSections';
import { useWorkHold } from '@/stores/prompt-queue.store';
import { isFormPage } from '@/lib/mobile-nav';
import { PANE_SLIDE_TRANSITION } from '@/lib/motion';
import { SHEET_COLUMN } from './sheet-column';
import { startsInOwnGesture, SWIPE_EDGE_PX, swipeAxis, swipeGoesBack, swipeOffset, type SwipeAxis } from '@/lib/swipe-back';

/**
 * A pushed page: "‹ Menu" (or "‹ Terug" on a page above another page) plus the page content. Plan 1 shows the existing sidebar card for the section
 * (SidebarSections filtered to one id); plan 2 swaps in the extracted D1 content with a title and description.
 * Swiping right also goes back (useSwipeBack); "‹ Menu" stays the way without dragging.
 */
export default function MobilePage({ page, depth, mapRef }: { page: Page; depth: number; mapRef: RefObject<MapRef | null> }) {
  const pop = useMobileNavStore((s) => s.pop);
  // A form page (Hint registreren): no follow-up prompt over it while it's open, and no swipe-back (a sideways slip
  // while typing coordinates must not throw the form away; "‹ Menu" still goes back)
  const formPage = isFormPage(page.id);
  useWorkHold(formPage);
  const { ref: swipeRef, x, handlers } = useSwipeBack(pop, !formPage);
  return (
    <motion.div
      ref={swipeRef}
      style={{ x }}
      {...handlers}
      className={`flex flex-col gap-3 pr-[max(0.75rem,env(safe-area-inset-right))] pb-8 pl-[max(0.75rem,env(safe-area-inset-left))] landscape-phone:px-3 ${SHEET_COLUMN}`}
    >
      {/* Takes focus when the page pushes in (MobileShell); 44px tall on phone-width screens (the phone layout, whatever the pointer). Inset focus ring: it sits at the top edge of the sheet's scroller */}
      <button type="button" data-view-back onClick={pop} aria-label={depth > 1 ? undefined : 'Terug naar menu'} className="flex h-10 w-fit items-center gap-1 rounded-xl pl-1 pr-2.5 text-body font-semibold text-muted-foreground outline-none transition-colors active:bg-beheer-row-high focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset max-md:h-11 pointer-coarse:h-11">
        <ChevronLeftIcon className="size-5" /> {depth > 1 ? 'Terug' : 'Menu'}
      </button>
      <PageBody>
        <SidebarSections mapRef={mapRef} only={page.id} />
      </PageBody>
    </motion.div>
  );
}

function PageBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>;
}

interface SwipeGesture {
  startX: number;
  startY: number;
  axis: SwipeAxis;
  lastX: number;
  lastTime: number;
  /** px/ms over the last move */
  velocity: number;
}

/**
 * Swipe right on the page to go back (lib/swipe-back.ts decides): the page follows the finger, then either leaves the
 * way a pop does (MobileShell's PANE_SLIDE, out to the right) or eases back. Vertical scrolling stays native (passive
 * touch listeners, an axis lock), and a drag that starts in a field, a slider, horizontally scrollable content or at the
 * screen's left edge (the system back gesture) is left alone. `enabled` false (form pages): no swipe at all.
 */
function useSwipeBack(pop: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const reduceMotion = useReducedMotion();
  const gesture = useRef<SwipeGesture | null>(null);
  // A horizontal drag ending on a button must not also press it
  const swallowClick = useRef(false);

  const settle = () => {
    if (reduceMotion) x.set(0);
    else animate(x, 0, PANE_SLIDE_TRANSITION);
  };

  // A swipe that popped the page leaves x at the finger's offset while it slides out. Pushed again before that exit
  // finishes, AnimatePresence brings this same page back: start it from 0, or it would return shifted sideways.
  const isPresent = useIsPresent();
  useEffect(() => {
    if (isPresent) x.set(0);
  }, [isPresent, x]);

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    swallowClick.current = false;
    const touch = event.touches[0];
    if (!enabled || event.touches.length !== 1 || !touch || !ref.current || touch.clientX < SWIPE_EDGE_PX || startsInOwnGesture(event.target, ref.current)) {
      gesture.current = null;
      return;
    }
    gesture.current = { startX: touch.clientX, startY: touch.clientY, axis: 'pending', lastX: touch.clientX, lastTime: event.timeStamp, velocity: 0 };
  };

  const onTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const current = gesture.current;
    const touch = event.touches[0];
    if (!current || current.axis === 'vertical' || !touch) return;
    const dx = touch.clientX - current.startX;
    if (current.axis === 'pending') {
      current.axis = swipeAxis(dx, touch.clientY - current.startY);
      if (current.axis !== 'horizontal') return;
    }
    const elapsed = event.timeStamp - current.lastTime;
    if (elapsed > 0) current.velocity = (touch.clientX - current.lastX) / elapsed;
    current.lastX = touch.clientX;
    current.lastTime = event.timeStamp;
    swallowClick.current = true;
    x.set(swipeOffset(dx));
  };

  // The click a drag could end in comes right after touchend; later on, a keyboard or assistive-technology click must
  // not be eaten by a flag left from a drag that produced none
  const releaseClick = () => {
    if (swallowClick.current) setTimeout(() => (swallowClick.current = false), 0);
  };

  const onTouchEnd = () => {
    releaseClick();
    const current = gesture.current;
    gesture.current = null;
    if (!current || current.axis !== 'horizontal') return;
    const width = ref.current?.clientWidth ?? window.innerWidth;
    if (swipeGoesBack(current.lastX - current.startX, current.velocity, width)) pop();
    else settle();
  };

  const onTouchCancel = () => {
    releaseClick();
    const current = gesture.current;
    gesture.current = null;
    if (current?.axis === 'horizontal') settle();
  };

  const onClickCapture = (event: { preventDefault: () => void; stopPropagation: () => void }) => {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return { ref, x, handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel, onClickCapture } };
}
