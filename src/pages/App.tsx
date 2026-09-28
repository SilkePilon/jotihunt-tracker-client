import { useOutlet } from '@/hooks/outlet.hook.ts';
import SearchCard from '@/components/cards/search/SearchCard.tsx';
import CoordinatesCard from '@/components/cards/coordinates/CoordinatesCard.tsx';
import Sidebar from '@/components/sidebar/Sidebar';
import HuntCaptureButton from '@/components/hunts/HuntCaptureButton';
import HuntRegistrationDialog from '@/components/hunts/HuntRegistrationDialog';
import { useIsMobile } from '@/hooks/media.hook';

function App() {
  const { mapRef } = useOutlet();
  const isMobile = useIsMobile();

  return (
    <>
      <div className="absolute left-2 right-2 top-2 z-30 flex gap-2 md:left-auto md:right-12">
        <div className="hidden md:block">
          <CoordinatesCard mapRef={mapRef} />
        </div>
        <div className="w-full md:w-auto">
          <SearchCard mapRef={mapRef} />
        </div>
      </div>
      <Sidebar mapRef={mapRef} />
      {isMobile && <HuntCaptureButton />}
      <HuntRegistrationDialog />
    </>
  );
}

export default App;
