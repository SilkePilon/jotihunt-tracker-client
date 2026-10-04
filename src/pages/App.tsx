import { useOutlet } from '@/hooks/outlet.hook.ts';
import SearchCard from '@/components/cards/search/SearchCard.tsx';
import CoordinatesCard from '@/components/cards/coordinates/CoordinatesCard.tsx';
import Sidebar from '@/components/sidebar/Sidebar';
import HuntCaptureButton from '@/components/hunts/HuntCaptureButton';
import HuntRegistrationDialog from '@/components/hunts/HuntRegistrationDialog';
import { useIsMobile } from '@/hooks/media.hook';
import { tourTarget } from '@/components/tour/targets';
import ErrorBoundary from '@/components/ErrorBoundary';

function App() {
  const { mapRef } = useOutlet();
  const isMobile = useIsMobile();

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
      <ErrorBoundary name="De zijbalk" variant="floating">
        <Sidebar mapRef={mapRef} />
      </ErrorBoundary>
      <ErrorBoundary name="Hunt registreren" variant="floating">
        {isMobile && <HuntCaptureButton />}
        <HuntRegistrationDialog />
      </ErrorBoundary>
    </>
  );
}

export default App;
