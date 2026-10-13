import { MapPinIcon } from 'lucide-react';
import { Marker } from 'react-map-gl/maplibre';
import { useDistanceFromMe } from '@/hooks/distance-from-me.hook';
import { useHintFormBridge } from '@/hooks/hint-bridge.hook';
import useSidebarStore from '@/stores/sidebar.store';
import MapPopup from './MapPopup';
import MarkerRegistration from './MarkerRegistration';
import CoordRows from './popup/CoordRows';
import { MapsAction, PopupActions } from './popup/PopupActions';
import PopupHeader, { PopupIcon } from './popup/PopupHeader';

// Above the 18px picked-location puck
const POPUP_OFFSET = { bottom: [0, -15] as [number, number] };

/** The clicked map point: coordinates (copy, into the hint form), Google Maps and register a hunt / spot here. */
export default function PickedLocationPopup({ lat, lng, onClose }: { lat: number; lng: number; onClose: () => void }) {
  const setCoords = useHintFormBridge((s) => s.setCoords);
  const openSection = useSidebarStore((s) => s.openSection);
  const setSheetSnap = useSidebarStore((s) => s.setSheetSnap);
  const distance = useDistanceFromMe(lat, lng);

  function setHintCoords(rd: { x: string; y: string }) {
    setCoords(rd.x, rd.y);
    // The hint entry section is collapsed by default: make sure it is visible (and scrolled into view on mobile)
    openSection('hintEntry');
    setSheetSnap('full');
  }

  return (
    <>
      <Marker longitude={lng || 0} latitude={lat || 0} anchor="center">
        <span className="jh-picked-dot" />
      </Marker>
      <MapPopup onClose={onClose} longitude={lng || 0} latitude={lat || 0} offset={POPUP_OFFSET}>
        <PopupHeader
          icon={
            <PopupIcon background="var(--map-selected-bg)" color="var(--map-selected-fg)">
              <MapPinIcon />
            </PopupIcon>
          }
          title="Gekozen locatie"
          subtitle={distance}
        />
        <CoordRows lat={lat} lng={lng} onHint={setHintCoords} />
        <PopupActions>
          <MapsAction lat={lat} lng={lng} />
          <MarkerRegistration lat={lat} lng={lng} />
        </PopupActions>
      </MapPopup>
    </>
  );
}
