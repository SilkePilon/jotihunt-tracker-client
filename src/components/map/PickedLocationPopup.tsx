import { useEffect, useState } from 'react';
import { LightbulbIcon, MapPinIcon } from 'lucide-react';
import { Marker, useMap } from 'react-map-gl/maplibre';
import { useDistanceFromMe } from '@/hooks/distance-from-me.hook';
import { useHintFormBridge } from '@/hooks/hint-bridge.hook';
import useSidebarStore from '@/stores/sidebar.store';
import useMobileNavStore from '@/stores/mobile-nav.store';
import { useIsMobile } from '@/hooks/media.hook';
import MapPopup from './MapPopup';
import ArchiveReadOnlyNote from '@/components/ArchiveReadOnlyNote';
import MarkerRegistration from './MarkerRegistration';
import { rdText } from '@/lib/rd';
import CoordRows from './popup/CoordRows';
import { PopupActions, popupActionClass, RouteAction } from './popup/PopupActions';
import PopupHeader, { PopupIcon } from './popup/PopupHeader';

// Above the 18px picked-location puck
const POPUP_OFFSET = { bottom: [0, -15] as [number, number] };

/**
 * The clicked map point: coordinates (copy), Route, register a hunt / spot here, and "In hint" (its RD coordinates into
 * the hint registration). On phones "In hint" opens the hint form with the sheet at half and lets the card go, so the
 * pin stays in view above the sheet while the hint is filled in; the pin goes with the form (or a map tap).
 */
export default function PickedLocationPopup({ lat, lng, onClose }: { lat: number; lng: number; onClose: () => void }) {
  const setCoords = useHintFormBridge((s) => s.setCoords);
  const openSection = useSidebarStore((s) => s.openSection);
  const pushPage = useMobileNavStore((s) => s.push);
  const isMobile = useIsMobile();
  const distance = useDistanceFromMe(lat, lng);
  // Phones after "In hint": only the pin
  const [pinOnly, setPinOnly] = useState(false);
  const { current: map } = useMap();

  function toHint() {
    const rd = rdText(lng, lat);
    setCoords(rd.x, rd.y);
    if (isMobile) {
      // Phones: the sheet shows one page at a time; open the hint form at half height, the pin stays visible above it
      pushPage({ id: 'hintEntry' }, 'half');
      setPinOnly(true);
    } else {
      // Desktop: the hint entry section is collapsed by default, make sure it is visible
      openSection('hintEntry');
    }
  }

  // Pin only: gone once the hint form is no longer the open page, or on the next map tap
  useEffect(() => {
    if (!pinOnly) return;
    const unsubscribe = useMobileNavStore.subscribe((state) => {
      if (state.stack.at(-1)?.id !== 'hintEntry') onClose();
    });
    const mapInstance = map?.getMap();
    mapInstance?.once('click', onClose);
    return () => {
      unsubscribe();
      mapInstance?.off('click', onClose);
    };
  }, [pinOnly, map, onClose]);

  return (
    <>
      <Marker longitude={lng || 0} latitude={lat || 0} anchor="center">
        <span className="jh-picked-dot" />
      </Marker>
      {!pinOnly && (
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
          <CoordRows lat={lat} lng={lng} />
          <PopupActions>
            <RouteAction lat={lat} lng={lng} compact />
            <MarkerRegistration lat={lat} lng={lng} />
          </PopupActions>
          {/* Hunt/Spot are greyed out in an archive edition: say why */}
          <ArchiveReadOnlyNote className="pt-2 text-(--map-muted)" />
          <PopupActions className="mt-2">
            <button type="button" className={popupActionClass('neutral', 'min-w-0 flex-1')} onClick={toHint}>
              <LightbulbIcon /> In hint
            </button>
          </PopupActions>
        </MapPopup>
      )}
    </>
  );
}
