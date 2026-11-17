import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { useMap } from 'react-map-gl/maplibre';
import { useAnnouncePopup } from '@/components/map/popup/popup-a11y';
import { CloseButton } from '@/components/ui/close-button';
import { useBackEntry } from '@/hooks/back-entry.hook';
import { useRestoreFocus } from '@/hooks/restore-focus.hook';
import { EASE_OUT } from '@/lib/motion';

export const DOCK_ID = 'map-popup-dock';

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
    return () => {
      // Closed via X/Back: the card is inert and has already animated away
      if (node.inert) return;
      // StrictMode's simulated unmount keeps the node in the DOM; a real unmount has detached it by now
      queueMicrotask(() => {
        if (node.isConnected || !dock.isConnected) return;
        const ghost = node.cloneNode(true) as HTMLElement;
        ghost.setAttribute('aria-hidden', 'true');
        // Not a second dialog, nor a second element with the (reused) title id
        ghost.removeAttribute('role');
        for (const element of ghost.querySelectorAll('[id]')) element.removeAttribute('id');
        ghost.style.cssText += ';position:absolute;left:0;right:0;bottom:0;pointer-events:none;';
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
 * would hide it). The map eases the point into view; the padding keeps it above the sheet. Back or X closes it.
 */
export default function DockedPopup({
  longitude,
  latitude,
  onClose,
  titleId,
  children,
}: {
  longitude: number;
  latitude: number;
  onClose: () => void;
  /** PopupHeader's title id, which names the card's dialog role */
  titleId?: string;
  children: ReactNode;
}) {
  const { current: map } = useMap();
  const dock = useDock();
  // X and Back animate the card away first, then close for real
  const [closing, setClosing] = useState(false);
  const exited = useRef(false);
  const requestClose = () => setClosing(true);
  useBackEntry('popup', true, requestClose);
  const ref = useExitGhost(dock);
  useAnnouncePopup(ref, dock);
  // Ease once per mount: live popups (hunters, Life360) get new coordinates on every GPS update and must not fight
  // the user's pan/zoom. Switching to another point remounts the popup (key), which eases again.
  const [center] = useState<[number, number]>(() => [longitude, latitude]);
  useEffect(() => {
    map?.easeTo({ center, duration: 500 });
  }, [map, center]);
  // Focus goes back where it came from (else the map) once the card is gone, unless a tap elsewhere already moved it
  useRestoreFocus(() => map?.getCanvas());

  if (!dock) return null;
  return createPortal(
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={closing ? EXIT : { opacity: 1, y: 0 }}
      transition={closing ? EXIT_TRANSITION : { duration: 0.25, ease: EASE_OUT }}
      onAnimationComplete={() => {
        if (!closing || exited.current) return;
        exited.current = true;
        onClose();
      }}
      inert={closing}
      role="dialog"
      aria-labelledby={titleId}
      className="pointer-events-auto relative rounded-3xl bg-card p-3.5 text-[13px] leading-[1.35] text-card-foreground shadow-[0_0_0_1px_var(--border),0_18px_50px_rgb(0_0_0/.35)]"
    >
      <CloseButton onClick={requestClose} className="absolute top-3 right-3" />
      <div className="flex flex-col">{children}</div>
    </motion.div>,
    dock,
  );
}
