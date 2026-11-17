import { RefObject, useEffect, useRef } from 'react';
import { MapRef } from '@/components/Map';
import { useIsMobile } from '@/hooks/media.hook';
import SidebarHeader from './SidebarHeader';
import SidebarSections from './SidebarSections';
import { tourTarget } from '@/components/tour/targets';
import MobileShell from '@/components/mobile/MobileShell';
import { hasMoreBelow } from '@/lib/scroll-fade';
import { WORK_AREA_ATTRIBUTE } from '@/stores/prompt-queue.store';

/**
 * Sets `data-more-below` on the scroller while there is content below its visible part (scroll, the content growing as
 * sections open, the window resizing); the CSS fades its bottom 24px then (sidebar-scroll-fade in index.css).
 */
function useBottomFade(scroller: RefObject<HTMLDivElement | null>, content: RefObject<HTMLDivElement | null>, enabled: boolean) {
  useEffect(() => {
    const el = scroller.current;
    if (!enabled || !el) return;
    const update = () => el.toggleAttribute('data-more-below', hasMoreBelow(el));
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (content.current) observer.observe(content.current);
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [scroller, content, enabled]);
}

export default function Sidebar({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const isMobile = useIsMobile();
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  // Desktop only: the phone shell has its own scrollers
  useBottomFade(scroller, content, !isMobile);

  if (isMobile) return <MobileShell mapRef={mapRef} />;

  return (
    // Safe-area insets: landscape phones at desktop width (viewport-fit=cover); 0 on desktops, so still 8px there
    <aside aria-label="Zijbalk" {...{ [WORK_AREA_ATTRIBUTE]: '' }} className="pointer-events-none absolute bottom-[calc(0.5rem+env(safe-area-inset-bottom))] left-[calc(0.5rem+env(safe-area-inset-left))] top-[calc(0.5rem+env(safe-area-inset-top))] z-40 w-[320px]">
      {/* Plain overflow container: Radix ScrollArea's table wrapper lets content grow wider than 300px.
          The scroller itself takes pointer events: iOS/iPadOS Safari won't touch-scroll a pointer-events:none
          scroller from pointer-events:auto children (WebKit bug 183870). max-h-full, not h-full, so the empty
          space below short content stays click-through to the map. */}
      <div ref={scroller} className="sidebar-scroll-fade pointer-events-auto max-h-full overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div ref={content} className="flex flex-col gap-1.5 pb-2" {...tourTarget('sidebar.root')}>
          <SidebarHeader />
          <SidebarSections mapRef={mapRef} />
        </div>
      </div>
    </aside>
  );
}
