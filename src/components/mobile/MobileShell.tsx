import { type RefObject, useEffect, useState } from 'react';
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

/** Back entries per pushed page, newest last (Back pops the newest page). */
function PageBackEntry({ depth }: { depth: number }) {
  const pop = useMobileNavStore((s) => s.pop);
  useBackEntry(`page:${depth}`, true, pop);
  return null;
}

/** Phones: the bottom sheet (peek strip + menu/page stack), camera button and popup dock. */
export default function MobileShell({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  useViewportInsets();
  const snap = useSidebarStore((s) => s.sheetSnap);
  const setSnap = useSidebarStore((s) => s.setSheetSnap);
  const { stack, direction } = useMobileNavStore();
  const [heights, setHeights] = useState<SnapHeights>({ peek: 0, half: 0, full: 0 });
  const dockBottom = useTransform(sheetVisibleHeight, (h) => h + 10);
  const top = stack[stack.length - 1];
  // Leaving phone width unmounts the shell; the next phone visit starts at the menu
  useEffect(() => () => useMobileNavStore.getState().reset(), []);

  // Declared before the page entries: Back closes pages first, then lowers the sheet
  useBackEntry('sheet', snap !== 'peek', () => setSnap('peek'));

  return (
    <>
      <ViewportDebug snaps={heights} />
      <motion.div id={DOCK_ID} className="pointer-events-none fixed inset-x-3 z-[45] flex flex-col gap-2" style={{ bottom: dockBottom }} />
      <HuntMarkerButton />
      <BottomSheet peek={<PeekStrip />} onHeights={setHeights}>
        {stack.map((page, i) => (
          <PageBackEntry key={`${i}:${page.id}`} depth={i + 1} />
        ))}
        {/* The menu stays mounted (keeps its scroll) while a page is open */}
        <div hidden={!!top}>
          <MobileMenu />
        </div>
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          {top && (
            <motion.div key={`${stack.length}:${top.id}`} custom={direction} variants={PANE_SLIDE} initial="enter" animate="center" exit="exit" transition={PANE_SLIDE_TRANSITION}>
              <MobilePage page={top} mapRef={mapRef} />
            </motion.div>
          )}
        </AnimatePresence>
      </BottomSheet>
    </>
  );
}
