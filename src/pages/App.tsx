import { useOutlet } from '@/hooks/outlet.hook.ts';
import SearchCard from '@/components/cards/search/SearchCard.tsx';
import CoordinatesCard from '@/components/cards/coordinates/CoordinatesCard.tsx';
import Sidebar from '@/components/sidebar/Sidebar';
import { tourTarget } from '@/components/tour/targets';
import ErrorBoundary from '@/components/ErrorBoundary';
import HappyHourPill from '@/components/happy-hour/HappyHourPill';

function App() {
  const { mapRef } = useOutlet();

  return (
    <>
      {/* Desktop only: on phones the map stays free (search via the sidebar, groups via the map) */}
      <div className="absolute right-2 top-2 z-30 hidden gap-2 md:flex" {...tourTarget('cards.topRight')}>
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
      {/*
        Centred over the map: right of the 320 px sidebar on desktop (half of its 328 px = 164 px) and under the
        search / coordinates row; on phones under the offline badge and the attribution button.
      */}
      <div className="pointer-events-none absolute top-10 left-1/2 z-30 -translate-x-1/2 md:top-[52px] md:left-[calc(50%+164px)]">
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
