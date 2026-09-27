import { RefObject } from 'react';
import { MapRef } from '@/components/Map';
import { useIsMobile } from '@/hooks/media.hook';
import SidebarHeader from './SidebarHeader';
import SidebarSections from './SidebarSections';
import MobileSheet from './MobileSheet';

export default function Sidebar({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <MobileSheet header={<SidebarHeader />}>
        <SidebarSections mapRef={mapRef} />
      </MobileSheet>
    );
  }

  return (
    <aside className="pointer-events-none absolute bottom-2 left-2 top-2 z-40 w-[320px]">
      {/* Plain overflow container: Radix ScrollArea's table wrapper lets content grow wider than 300px */}
      <div className="h-full overflow-y-auto [scrollbar-width:thin]">
        <div className="pointer-events-auto flex flex-col gap-1.5 pb-2">
          <SidebarHeader />
          <SidebarSections mapRef={mapRef} />
        </div>
      </div>
    </aside>
  );
}
