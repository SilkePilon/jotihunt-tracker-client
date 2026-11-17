import { useEffect, useState } from 'react';
import { LightbulbIcon, MapPinIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
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
import { SWAP } from '@/lib/motion';

// Above the 18px picked-location puck
const POPUP_OFFSET = { bottom: [0, -15] as [number, number] };
/** How long "In hint ✓" shows after the coordinates went into the form (laptop) */
const SENT_MS = 1600;

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
  // Laptop: "In hint ✓" for a moment once the coordinates are in the form (the popup stays open there)
  const [sent, setSent] = useState(false);
  const { current: map } = useMap();

  useEffect(() => {
    if (!sent) return;
    const timer = setTimeout(() => setSent(false), SENT_MS);
    return () => clearTimeout(timer);
  }, [sent]);

  function toHint() {
    const rd = rdText(lng, lat);
    // Laptop: the form scrolls into view and the focus goes to Deelgebied (HintEntryCard), so it's clear where they went
    setCoords(rd.x, rd.y, { reveal: !isMobile });
    if (isMobile) {
      // Phones: the sheet shows one page at a time; open the hint form at half height, the pin stays visible above it
      pushPage({ id: 'hintEntry' }, 'half');
      setPinOnly(true);
    } else {
      // Desktop: the hint entry section is collapsed by default, make sure it is visible
      openSection('hintEntry');
      setSent(true);
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
            {/* Registered here: the point is done, the popup goes once the dialog has closed */}
            <MarkerRegistration lat={lat} lng={lng} onRegistered={onClose} />
          </PopupActions>
          {/* Hunt/Spot are greyed out in an archive edition: say why */}
          <ArchiveReadOnlyNote className="pt-2 text-(--map-muted)" />
          <PopupActions className="mt-2">
            <button type="button" className={popupActionClass('neutral', 'min-w-0 flex-1')} onClick={toHint}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={sent ? 'sent' : 'idle'} {...SWAP} className="inline-flex items-center gap-1.5">
                  <LightbulbIcon /> {sent ? 'In hint ✓' : 'In hint'}
                </motion.span>
              </AnimatePresence>
            </button>
          </PopupActions>
        </MapPopup>
      )}
    </>
  );
}
