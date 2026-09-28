import { ReactNode, useRef } from 'react';
import { Drawer } from 'vaul';
import useSidebarStore, { SheetSnap } from '@/stores/sidebar.store';
import { cn } from '@/lib/utils';

const SNAP_POINTS: (string | number)[] = ['200px', 0.5, 0.92];
const SNAP_BY_NAME: Record<SheetSnap, string | number> = { peek: SNAP_POINTS[0], half: SNAP_POINTS[1], full: SNAP_POINTS[2] };

function snapName(snap: string | number | null): SheetSnap {
  if (snap === SNAP_BY_NAME.full) return 'full';
  if (snap === SNAP_BY_NAME.half) return 'half';
  return 'peek';
}

/**
 * Always-visible bottom sheet for phones. Non-modal so the map stays usable above it.
 */
export default function MobileSheet({ header, children }: { header: ReactNode; children: ReactNode }) {
  const sheetSnap = useSidebarStore((state) => state.sheetSnap);
  const setSheetSnap = useSidebarStore((state) => state.setSheetSnap);
  const contentRef = useRef<HTMLDivElement>(null);

  function changeSnap(snap: string | number | null) {
    const name = snapName(snap);
    // vaul refuses to drag while its content is scrolled; below "full" the content can't be scrolled back by hand
    if (name !== 'full' && contentRef.current) contentRef.current.scrollTop = 0;
    setSheetSnap(name);
  }

  // select-none: a long press would select text, and vaul won't drag while text is selected. Inputs stay selectable.
  return (
    <Drawer.Root
      open
      modal={false}
      dismissible={false}
      snapPoints={SNAP_POINTS}
      activeSnapPoint={SNAP_BY_NAME[sheetSnap]}
      setActiveSnapPoint={changeSnap}
    >
      <Drawer.Portal>
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-40 flex h-full max-h-[92dvh] select-none flex-col rounded-t-2xl border-t bg-background outline-none [-webkit-touch-callout:none] [&_input]:select-text [&_textarea]:select-text"
        >
          <Drawer.Handle className="mx-auto mb-1 mt-2" />
          <Drawer.Title className="sr-only">Zijbalk</Drawer.Title>
          <div className="px-2">{header}</div>
          <div
            ref={contentRef}
            className={cn(
              'flex flex-1 flex-col gap-1.5 px-2 pt-1.5 pb-[max(1.5rem,env(safe-area-inset-bottom))]',
              sheetSnap === 'full' ? 'overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'overflow-hidden',
            )}
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
