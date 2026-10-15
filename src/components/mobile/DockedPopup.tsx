import { type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { XIcon } from 'lucide-react';
import { useMap } from 'react-map-gl/maplibre';
import { useBackEntry } from '@/hooks/back-entry.hook';
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

/**
 * Phones: a map popup as a card docked just above the sheet instead of floating at the point (where the sheet
 * would hide it). The map eases the point into view; the padding keeps it above the sheet. Back or X closes it.
 */
export default function DockedPopup({ longitude, latitude, onClose, children }: { longitude: number; latitude: number; onClose: () => void; children: ReactNode }) {
  const { current: map } = useMap();
  const dock = useDock();
  useBackEntry('popup', true, onClose);
  // Ease once per mount: live popups (hunters, Life360) get new coordinates on every GPS update and must not fight
  // the user's pan/zoom. Switching to another point remounts the popup (key), which eases again.
  const [center] = useState<[number, number]>(() => [longitude, latitude]);
  useEffect(() => {
    map?.easeTo({ center, duration: 500 });
  }, [map, center]);

  if (!dock) return null;
  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
      className="pointer-events-auto relative rounded-2xl bg-card p-2.5 text-[12.5px] leading-[1.35] text-card-foreground shadow-[0_0_0_1px_var(--border),0_6px_20px_rgb(0_0_0/.5)]"
    >
      <button type="button" aria-label="Sluiten" onClick={onClose} className="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-full text-muted-foreground">
        <XIcon className="size-4" />
      </button>
      <div className="flex flex-col pr-6">{children}</div>
    </motion.div>,
    dock,
  );
}
