import { useOutlet } from '@/hooks/outlet.hook.ts';
import SearchCard from '@/components/cards/search/SearchCard.tsx';
import CoordinatesCard from '@/components/cards/coordinates/CoordinatesCard.tsx';
import Sidebar from '@/components/sidebar/Sidebar';
import HuntCaptureButton from '@/components/hunts/HuntCaptureButton';
import HuntRegistrationDialog from '@/components/hunts/HuntRegistrationDialog';
import NewHuntToaster from '@/components/hunts/NewHuntToaster';
import { useIsMobile } from '@/hooks/media.hook';

function App() {
  const { mapRef } = useOutlet();
  const isMobile = useIsMobile();

  return (
    <>
      {/* Desktop only: on phones the map stays free (search via the sidebar, groups via the map) */}
      <div className="absolute right-12 top-2 z-30 hidden gap-2 md:flex">
        <div>
          <CoordinatesCard mapRef={mapRef} />
        </div>
        <div>
          <SearchCard mapRef={mapRef} />
        </div>
      </div>
      <Sidebar mapRef={mapRef} />
      {isMobile && <HuntCaptureButton />}
      <HuntRegistrationDialog />
      <NewHuntToaster />
    </>
  );
}

export default App;
