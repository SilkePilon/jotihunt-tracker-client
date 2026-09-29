import { RefObject } from 'react';
import { Drawer } from 'vaul';
import { MapRef } from '@/components/Map';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/media.hook';
import useHintBoardStore from '@/stores/hint-board.store';
import useSidebarStore from '@/stores/sidebar.store';
import HintBoard, { HintLegend, NewHintAlert } from './HintBoard';
import HintDetailDialog from './HintDetailDialog';

/**
 * The hint board overview (a large dialog on desktop, a bottom drawer on phones, on top of the sidebar sheet) and the
 * detail dialog of a single hint cell.
 */
export default function HintBoardDialog({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const isMobile = useIsMobile();
  const view = useHintBoardStore((state) => state.view);
  const close = useHintBoardStore((state) => state.close);
  const setSheetSnap = useSidebarStore((state) => state.setSheetSnap);
  const overviewOpen = view === 'overview';

  function showOnMap(lng: number, lat: number) {
    close();
    // On phones, lower the sidebar sheet so the hint location is visible
    if (isMobile) setSheetSnap('peek');
    mapRef.current?.flyTo({ center: [lng, lat], duration: 2000, zoom: 15 });
  }

  const overview = isMobile ? (
    <Drawer.Root open={overviewOpen} onOpenChange={(next) => !next && close()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex h-[92dvh] flex-col rounded-t-2xl border-t bg-background outline-none">
          <Drawer.Handle className="mx-auto mb-1 mt-2" />
          <div className="flex flex-col gap-1 px-4 pb-2 pt-1">
            <Drawer.Title className="text-lg font-semibold">Hints</Drawer.Title>
            <Drawer.Description asChild>
              <div>
                <HintLegend />
              </div>
            </Drawer.Description>
          </div>
          <div className="flex min-h-0 flex-1 flex-col px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">{overviewOpen && <HintBoard />}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  ) : (
    <Dialog open={overviewOpen} onOpenChange={(next) => !next && close()}>
      <DialogContent className="flex h-[90dvh] max-h-[90dvh] flex-col gap-3 sm:max-w-6xl">
        <DialogHeader className="flex-row items-center gap-4 pr-8">
          <DialogTitle className="text-xl">Hints</DialogTitle>
          <DialogDescription asChild>
            <div className="ml-auto">
              <HintLegend />
            </div>
          </DialogDescription>
        </DialogHeader>
        {overviewOpen && <HintBoard />}
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      {view && <NewHintAlert />}
      {overview}
      <HintDetailDialog onShowOnMap={showOnMap} />
    </>
  );
}
