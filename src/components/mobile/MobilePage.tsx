import type { ReactNode, RefObject } from 'react';
import { ChevronLeftIcon } from 'lucide-react';
import type { MapRef } from '@/components/Map';
import type { MobilePage as Page } from '@/lib/mobile-nav';
import useMobileNavStore from '@/stores/mobile-nav.store';
import SidebarSections from '@/components/sidebar/SidebarSections';

/**
 * A pushed page: "‹ Menu" plus the page content. Plan 1 shows the existing sidebar card for the section
 * (SidebarSections filtered to one id); plan 2 swaps in the extracted D1 content with a title and description.
 */
export default function MobilePage({ page, mapRef }: { page: Page; mapRef: RefObject<MapRef | null> }) {
  const pop = useMobileNavStore((s) => s.pop);
  return (
    <div className="flex flex-col gap-3 px-3 pb-8">
      <button type="button" onClick={pop} className="flex h-10 w-fit items-center gap-1 rounded-xl pl-1 pr-2.5 text-[13.5px] font-semibold text-muted-foreground">
        <ChevronLeftIcon className="size-5" /> Menu
      </button>
      <PageBody>
        <SidebarSections mapRef={mapRef} only={page.id} />
      </PageBody>
    </div>
  );
}

function PageBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>;
}
