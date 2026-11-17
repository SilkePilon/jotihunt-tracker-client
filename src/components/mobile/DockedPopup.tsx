import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { useMap } from 'react-map-gl/maplibre';
import { useAnnouncePopup, useTakePopupFocus } from '@/components/map/popup/popup-a11y';
import { CloseButton } from '@/components/ui/close-button';
import { useBackEntry } from '@/hooks/back-entry.hook';
import { useRestoreFocus } from '@/hooks/restore-focus.hook';
import { ownsKey } from '@/lib/focus';
import { EASE_OUT, LAYOUT_SPRING } from '@/lib/motion';
import { useDockRow } from '@/hooks/dock-row.hook';
import { currentPhonePadding, pointHiddenByDock, setPaddingInPlace } from '@/lib/dock-camera';
import useFollowMeStore from '@/stores/follow-me.store';
import useSidebarStore from '@/stores/sidebar.store';
import useViewportStore from '@/stores/viewport.store';

export const DOCK_ID = 'map-popup-dock';
/** CSS variable on the dock: the most height a docked card may take (MobileShell keeps it in step with the sheet) */
export const DOCK_CARD_MAX_VAR = '--dock-card-max';

/** The dock element; re-renders once it exists when the popup mounts before the dock does. */
function useDock() {
  const [dock, setDock] = useState(() => document.getElementById(DOCK_ID));
  useEffect(() => {
    if (dock) return;
    const observer = new MutationObserver(() => {
      const element = document.getElementById(DOCK_ID);
      if (!element) return;
      observer.disconnect();
      setDock(element);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [dock]);
  return dock;
}

const EXIT = { opacity: 0, y: 16 };
const EXIT_TRANSITION = { duration: 0.2, ease: EASE_OUT };

/**
 * When the parent removes the popup (map tap, another point selected, popup swapped by key) there is no exit phase:
 * leave a non-interactive copy in the dock that fades and slides away, then drops itself.
 */
function useExitGhost(dock: HTMLElement | null) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // Runs again once the dock exists (the card only renders then)
    const node = ref.current;
    if (!node || !dock) return;
    let left = 0;
    let width = 0;
    // Measured while still laid out (a detached node has no box): on every resize, and once now
    const measure = () => {
      left = node.offsetLeft;
      width = node.offsetWidth;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
      measure();
      // Closed via X/Back: the card is inert and has already animated away
      if (node.inert) return;
      // StrictMode's simulated unmount keeps the node in the DOM; a real unmount has detached it by now
      queueMicrotask(() => {
        if (node.isConnected || !dock.isConnected) return;
        const ghost = node.cloneNode(true) as HTMLElement;
        ghost.setAttribute('aria-hidden', 'true');
        ghost.inert = true;
        // Not a second dialog, nor a second element with the (reused) title id
        ghost.removeAttribute('role');
        for (const element of ghost.querySelectorAll('[id]')) element.removeAttribute('id');
        // Where the card was: full width in the column dock, beside the tiles in the row dock (short screens)
        ghost.style.cssText += `;position:absolute;left:${left}px;width:${width}px;bottom:0;pointer-events:none;`;
        dock.appendChild(ghost);
        // Reduced motion: only the fade (MotionConfig skips the slide for motion's own exits; this is plain WAAPI)
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const keyframes = reduced ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(16px)' }];
        const animation = ghost.animate(keyframes, {
          duration: EXIT_TRANSITION.duration * 1000,
          easing: `cubic-bezier(${EASE_OUT.join(',')})`,
          fill: 'forwards',
        });
        const remove = () => ghost.remove();
        animation.finished.then(remove, remove);
      });
    };
  }, [dock]);
  return ref;
}

/**
 * Phones: a map popup as a card docked just above the sheet instead of floating at the point (where the sheet
 * would hide it). The map eases the point into view when the card would hide it; the padding keeps it above the sheet. Back, Escape or X closes it.
 */
export default function DockedPopup({
  longitude,
  latitude,
  onClose,
  titleId,
  takeFocus = false,
  children,
}: {
  longitude: number;
  latitude: number;
  onClose: () => void;
  /** PopupHeader's title id, which names the card's dialog role */
  titleId?: string;
  /** Opened from a list with the keyboard: the card takes focus */
  takeFocus?: boolean;
  children: ReactNode;
}) {
  const { current: map } = useMap();
  const dock = useDock();
  // X and Back animate the card away first, then close for real
  const [closing, setClosing] = useState(false);
  const row = useDockRow();
  const exited = useRef(false);
  const requestClose = () => setClosing(true);
  useBackEntry('popup', true, requestClose);
  const ref = useExitGhost(dock);
  useAnnouncePopup(ref, dock);
  // The map pads for the card while it is docked (Map.tsx), so its point stays visible above it
  const setDockCardHeight = useSidebarStore((s) => s.setDockCardHeight);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !dock) return;
    const measure = () => setDockCardHeight(node.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
      setDockCardHeight(0);
    };
  }, [dock, ref, setDockCardHeight]);
  // Ease once per mount: live popups (hunters, Life360) get new coordinates on every GPS update and must not fight
  // the user's pan/zoom. Switching to another point remounts the popup (key), which eases again.
  const [center] = useState<[number, number]>(() => [longitude, latitude]);
  useEffect(() => {
    // A list that opened this popup (Life360, hunt log) already flies there with a zoom: an ease now would cancel it.
    // Waits for the card, so the camera carries the padding for it (the map's padding effect then has nothing to do).
    if (!map || !dock || map.isMoving()) return;
    const instance = map.getMap();
    const container = instance.getContainer();
    const padding = currentPhonePadding(container.clientHeight);
    // This ease bypasses the map ref that ends following: stop it here, or FollowMe's catch-up would pull the own
    // position back under the card
    if (!padding) {
      useFollowMeStore.getState().stop();
      map.easeTo({ center, duration: 500 });
      return;
    }
    // Only a point the card (or sheet, or notch) would hide is brought into view; a tapped point that stays visible
    // keeps its place on screen, so every tap doesn't slide the map around
    const size = { width: container.clientWidth, height: container.clientHeight };
    if (pointHiddenByDock(instance.project(center), size, padding, useViewportStore.getState().safeTop)) {
      useFollowMeStore.getState().stop();
      map.easeTo({ center, duration: 500, padding });
    } else setPaddingInPlace(instance, padding);
  }, [map, center, dock]);
  // A map tap closes it like the desktop popup (instead of a second "Gekozen locatie" card stacking up); the exit
  // ghost animates it away. Added after the tap that opened it and after the layers' own click handlers, so tapping
  // the next marker still swaps the card (usePopupSelection).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const instance = map?.getMap();
    if (!instance) return;
    const onClick = () => onCloseRef.current();
    instance.on('click', onClick);
    return () => {
      instance.off('click', onClick);
    };
  }, [map]);
  // Focus goes back where it came from (else the map) once the card is gone, unless a tap elsewhere already moved it
  const setOpener = useRestoreFocus(() => map?.getCanvas());
  useTakePopupFocus(ref, dock, takeFocus, setOpener);
  // Escape closes it like Back (when focus is in the card, on the map or nowhere; not a menu or field elsewhere)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !ownsKey(event, document.body, [ref.current, map?.getContainer()])) return;
      event.preventDefault();
      setClosing(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [map, ref]);

  if (!dock) return null;
  return createPortal(
    <motion.div
      ref={ref}
      // Slides to its new place when the dock turns between row and column (only then: layoutDependency)
      layout="position"
      layoutDependency={row}
      initial={{ opacity: 0, y: 16 }}
      animate={closing ? EXIT : { opacity: 1, y: 0 }}
      transition={closing ? { ...EXIT_TRANSITION, layout: LAYOUT_SPRING } : { duration: 0.25, ease: EASE_OUT, layout: LAYOUT_SPRING }}
      onAnimationComplete={() => {
        if (!closing || exited.current) return;
        exited.current = true;
        onClose();
      }}
      inert={closing}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      style={{ maxHeight: `var(${DOCK_CARD_MAX_VAR}, none)` }}
      className="pointer-events-auto relative flex min-w-0 flex-col overflow-hidden outline-none rounded-3xl bg-card text-[13px] leading-[1.35] text-card-foreground shadow-(--shadow-dialog) [[data-dock=row]_&]:max-w-[360px] [[data-dock=row]_&]:flex-1"
    >
      {/* Outside the scroller, so the X stays put while a tall card scrolls (short landscape screens) */}
      <CloseButton onClick={requestClose} className="absolute top-3 right-3 z-10" />
      <div className="flex min-h-0 flex-col overflow-y-auto overscroll-contain p-3.5">{children}</div>
    </motion.div>,
    dock,
  );
}
