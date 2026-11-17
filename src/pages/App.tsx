import { useOutlet } from '@/hooks/outlet.hook.ts';
import SearchCard from '@/components/cards/search/SearchCard.tsx';
import CoordinatesCard from '@/components/cards/coordinates/CoordinatesCard.tsx';
import Sidebar from '@/components/sidebar/Sidebar';
import { tourTarget } from '@/components/tour/targets';
import ErrorBoundary from '@/components/ErrorBoundary';
import HappyHourPill from '@/components/happy-hour/HappyHourPill';
import { NavigationIcon, SearchIcon, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MAP_TILE } from '@/lib/map-chrome';
import { TRIGGER_OPEN } from '@/lib/menu-styles';
import { belowSafeArea, desktopTopStack, phoneTopStack } from '@/lib/top-stack';
import { cn } from '@/lib/utils';
import useTopStackStore from '@/stores/top-stack.store';

const WIDE_QUERY = '(min-width: 1024px)';

/** md–lg: a 44 px map tile whose popover holds the full card (the card is its own surface, so the popover has none) */
function CompactCard({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  // Widening to lg hides this tile and shows the full cards; a popover left open would hang from a hidden trigger
  useEffect(() => {
    if (!open) return;
    const media = window.matchMedia(WIDE_QUERY);
    const onChange = () => media.matches && setOpen(false);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [open]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className={cn(MAP_TILE, 'grid size-11 cursor-pointer place-items-center rounded-[14px] outline-none transition-colors hover:bg-beheer-row focus-visible:ring-[3px] focus-visible:ring-ring [&_svg]:size-[18px]', TRIGGER_OPEN)}
        >
          <Icon aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={8} aria-label={label} className="w-auto rounded-[14px] bg-transparent p-0 shadow-none">
        <ErrorBoundary>{children(() => setOpen(false))}</ErrorBoundary>
      </PopoverContent>
    </Popover>
  );
}

function App() {
  const { mapRef } = useOutlet();
  // Under the offline badge, lower while it wraps to two lines (lib/top-stack.ts); desktop: under the search row and the badge
  const pillTop = useTopStackStore((state) => phoneTopStack(state.heights).pillTop);
  const pillTopMd = useTopStackStore((state) => desktopTopStack(state.heights).pillTop);

  return (
    <>
      {/* Desktop only: on phones the map stays free (search via the sidebar, groups via the map). Between md and lg the
          two 300 px cards would slide under the 320 px sidebar, so they fold into two icon tiles that open the same card */}
      <div className="absolute top-[max(0.5rem,env(safe-area-inset-top))] right-[max(0.5rem,env(safe-area-inset-right))] z-30 hidden md:block" {...tourTarget('cards.topRight')}>
        <div className="hidden gap-2 lg:flex">
          <div>
            <ErrorBoundary>
              <CoordinatesCard mapRef={mapRef} />
            </ErrorBoundary>
          </div>
          <div>
            <ErrorBoundary>
              <SearchCard mapRef={mapRef} />
            </ErrorBoundary>
          </div>
        </div>
        <div className="flex gap-2 lg:hidden">
          <CompactCard icon={SearchIcon} label="Zoek op coördinaat">
            {(close) => <CoordinatesCard mapRef={mapRef} onDone={close} />}
          </CompactCard>
          <CompactCard icon={NavigationIcon} label="Snel navigeren naar groep">
            {(close) => <SearchCard mapRef={mapRef} onDone={close} />}
          </CompactCard>
        </div>
      </div>
      {/*
        Centred over the map: right of the 320 px sidebar on desktop (half of its 328 px = 164 px) and under the
        search / coordinates row (and the offline badge, which sits there too); on phones under the offline badge and the
        attribution button. The drawing toolbar and phone toasts start below it while it is shown (lib/top-stack.ts).
        Eases to its new place when the badge above it comes, goes or wraps.
      */}
      <div
        style={{ '--pill-top': belowSafeArea(pillTop), '--pill-top-md': `${pillTopMd}px` } as React.CSSProperties}
        className="pointer-events-none absolute top-(--pill-top) left-1/2 z-30 -translate-x-1/2 transition-[top] duration-300 ease-out motion-reduce:transition-none md:top-(--pill-top-md) md:left-[calc(50%+164px)]"
      >
        <ErrorBoundary variant="inline">
          <HappyHourPill />
        </ErrorBoundary>
      </div>
      <ErrorBoundary name="De zijbalk" variant="floating">
        <Sidebar mapRef={mapRef} />
      </ErrorBoundary>
    </>
  );
}

export default App;
