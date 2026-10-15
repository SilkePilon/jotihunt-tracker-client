import { RefObject } from 'react';
import { MapRef } from '@/components/Map';
import { useIsMobile } from '@/hooks/media.hook';
import SidebarHeader from './SidebarHeader';
import SidebarSections from './SidebarSections';
import { tourTarget } from '@/components/tour/targets';
import MobileShell from '@/components/mobile/MobileShell';

export default function Sidebar({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const isMobile = useIsMobile();

  if (isMobile) return <MobileShell mapRef={mapRef} />;

  return (
    // Safe-area insets: landscape phones at desktop width (viewport-fit=cover); 0 on desktops, so still 8px there
    <aside className="pointer-events-none absolute bottom-[calc(0.5rem+env(safe-area-inset-bottom))] left-[calc(0.5rem+env(safe-area-inset-left))] top-[calc(0.5rem+env(safe-area-inset-top))] z-40 w-[320px]">
      {/* Plain overflow container: Radix ScrollArea's table wrapper lets content grow wider than 300px */}
      <div className="h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="pointer-events-auto flex flex-col gap-1.5 pb-2" {...tourTarget('sidebar.root')}>
          <SidebarHeader />
          <SidebarSections mapRef={mapRef} />
        </div>
      </div>
    </aside>
  );
}
