import type { ReactNode, RefObject } from 'react';
import { ChevronLeftIcon } from 'lucide-react';
import type { MapRef } from '@/components/Map';
import type { MobilePage as Page } from '@/lib/mobile-nav';
import useMobileNavStore from '@/stores/mobile-nav.store';
import SidebarSections from '@/components/sidebar/SidebarSections';
import { useWorkHold } from '@/stores/prompt-queue.store';
import { isFormPage } from '@/lib/mobile-nav';

/**
 * A pushed page: "‹ Menu" (or "‹ Terug" on a page above another page) plus the page content. Plan 1 shows the existing sidebar card for the section
 * (SidebarSections filtered to one id); plan 2 swaps in the extracted D1 content with a title and description.
 */
export default function MobilePage({ page, depth, mapRef }: { page: Page; depth: number; mapRef: RefObject<MapRef | null> }) {
  const pop = useMobileNavStore((s) => s.pop);
  // A form page (Hint registreren): no follow-up prompt over it while it's open
  useWorkHold(isFormPage(page.id));
  return (
    <div className="flex flex-col gap-3 pr-[max(0.75rem,env(safe-area-inset-right))] pb-8 pl-[max(0.75rem,env(safe-area-inset-left))]">
      {/* Takes focus when the page pushes in (MobileShell); 44px tall on phone-width screens (the phone layout, whatever the pointer). Inset focus ring: it sits at the top edge of the sheet's scroller */}
      <button type="button" data-view-back onClick={pop} aria-label={depth > 1 ? undefined : 'Terug naar menu'} className="flex h-10 w-fit items-center gap-1 rounded-xl pl-1 pr-2.5 text-[13.5px] font-semibold text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset max-md:h-11">
        <ChevronLeftIcon className="size-5" /> {depth > 1 ? 'Terug' : 'Menu'}
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
