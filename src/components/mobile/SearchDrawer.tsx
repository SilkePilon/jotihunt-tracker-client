import type { RefObject } from 'react';
import type { MapRef } from '@/components/Map';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import ErrorBoundary from '@/components/ErrorBoundary';
import CoordinatesCard from '@/components/cards/coordinates/CoordinatesCard';
import SearchCard from '@/components/cards/search/SearchCard';
import useSidebarStore from '@/stores/sidebar.store';

/** Phones: the desktop's coordinate and group search cards in a drawer, opened from the menu's "Zoeken" row. */
export default function SearchDrawer({ mapRef, open, onClose }: { mapRef: RefObject<MapRef | null>; open: boolean; onClose: () => void }) {
  // Found something: close the drawer and lower the sheet so the map shows where it flew to
  const done = () => {
    onClose();
    useSidebarStore.getState().setSheetSnap('peek');
  };
  return (
    <ResponsiveDialog open={open} onClose={onClose} title="Zoeken" description="Zoek een coördinaat of ga snel naar een groep." compact drawerClassName="bg-card">
      {/* The coordinate field last, with room under it for its floating error. Scrolls when the drawer is short (a
          landscape phone): the controls stay reachable */}
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-1 pt-1 pb-12">
        <ErrorBoundary variant="inline">
          <SearchCard mapRef={mapRef} onDone={done} fluid />
        </ErrorBoundary>
        <ErrorBoundary variant="inline">
          <CoordinatesCard mapRef={mapRef} onDone={done} fluid />
        </ErrorBoundary>
      </div>
    </ResponsiveDialog>
  );
}
