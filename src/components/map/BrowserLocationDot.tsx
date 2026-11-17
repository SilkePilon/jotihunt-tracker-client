import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion, usePresence } from 'motion/react';
import { LocateFixedIcon } from 'lucide-react';
import { Layer, Marker, Source, type FillLayerSpecification } from 'react-map-gl/maplibre';
import ArchiveReadOnlyNote from '@/components/ArchiveReadOnlyNote';
import MapPopup from './MapPopup';
import MarkerRegistration from './MarkerRegistration';
import { PopupActions } from './popup/PopupActions';
import PopupHeader, { PopupIcon } from './popup/PopupHeader';
import { usePopupSelection } from '../layers/map-interactions';
import { useDevices } from '@/hooks/devices.hook';
import { AGE_CLOCK_TICK_MS, useNow } from '@/hooks/now.hook';
import { useTrackerStatus } from '@/hooks/tracker.hook';
import { MAP_LOCATION_COLOR } from '@/lib/map-chrome';
import { OWN_ACCURACY_MIN_M, ownAccuracyCircle } from '@/lib/map-layers';
import { POP } from '@/lib/motion';
import { OWN_POSITION_FRESH_MS, ownDeviceId, ownTrackerPosition } from '@/lib/own-position';
import useBrowserLocationStore from '@/stores/browser-location.store';

/** Opacity of a dot whose last fix is from before the page was hidden, until a fresh one comes in */
const STALE_DOT_OPACITY = 0.5;

/**
 * The dot itself: pops in, and pops out before its Marker goes (a Marker has no exit phase of its own). A tap on it
 * (44px target around the 14px dot) opens the Hunt/Spot popup for where you stand.
 */
function Dot({ lng, lat, fresh, onOpen }: { lng: number; lat: number; fresh: boolean; onOpen: () => void }) {
  const [isPresent, safeToRemove] = usePresence();
  return (
    <Marker
      longitude={lng}
      latitude={lat}
      anchor="center"
      onClick={(event) => {
        // The map's own click would otherwise open the "Gekozen locatie" card (or close this popup) as well
        event.originalEvent.stopPropagation();
        onOpen();
      }}
    >
      <button
        type="button"
        aria-label="Mijn locatie: Hunt of Spot hier"
        className="grid size-11 cursor-pointer place-items-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        <motion.span
          aria-hidden
          className="relative block size-3.5 rounded-full shadow-[0_0_0_2px_#fff,0_1px_4px_rgb(0_0_0/0.3)]"
          style={{ backgroundColor: MAP_LOCATION_COLOR }}
          initial={POP.initial}
          animate={isPresent ? { ...POP.animate, opacity: fresh ? 1 : STALE_DOT_OPACITY } : POP.exit}
          transition={isPresent ? POP.transition : POP.exit.transition}
          onAnimationComplete={() => {
            if (!isPresent) safeToRemove?.();
          }}
        >
          {/* Pulse ring while fixes come in; none under reduced motion */}
          {fresh && (
            <span
              className="absolute -inset-0.5 -z-10 rounded-full motion-safe:animate-[jh-marker-pulse_1.6s_ease-out_infinite] motion-reduce:hidden"
              style={{ backgroundColor: MAP_LOCATION_COLOR }}
            />
          )}
        </motion.span>
      </button>
    </Marker>
  );
}

/** Where you stand (taken when the dot was tapped, so the point doesn't drift while registering): Hunt or Spot here. */
function OwnLocationPopup({ lng, lat, accuracy, onClose }: { lng: number; lat: number; accuracy: number | null; onClose: () => void }) {
  return (
    <MapPopup longitude={lng} latitude={lat} onClose={onClose} offset={OWN_POPUP_OFFSET}>
      <PopupHeader
        icon={
          <PopupIcon background={MAP_LOCATION_COLOR} color="#fff">
            <LocateFixedIcon />
          </PopupIcon>
        }
        title="Mijn locatie"
        subtitle={accuracy !== null && Number.isFinite(accuracy) ? `Tot op ± ${Math.round(accuracy)} m nauwkeurig` : undefined}
      />
      <PopupActions>
        <MarkerRegistration lat={lat} lng={lng} />
      </PopupActions>
      {/* Hunt/Spot are greyed out in an archive edition: say why */}
      <ArchiveReadOnlyNote className="pt-2 text-(--map-muted)" />
    </MapPopup>
  );
}

// Just above the dot
const OWN_POPUP_OFFSET = { bottom: [0, -12] as [number, number] };

const ACCURACY_SOURCE = 'browser-location-accuracy';
// Like the hunters' accuracy circles (Devices.tsx), in the own-position colour; fades in and out (paint transition)
const ACCURACY_FADE = { duration: 300, delay: 0 };
function accuracyPaint(shown: boolean): FillLayerSpecification['paint'] {
  return {
    'fill-color': MAP_LOCATION_COLOR,
    'fill-opacity': shown ? 0.12 : 0,
    'fill-opacity-transition': ACCURACY_FADE,
    'fill-outline-color': MAP_LOCATION_COLOR,
  };
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

/** Whether the page is visible (not a background tab, not a locked phone). */
function usePageVisible(): boolean {
  return useSyncExternalStore(subscribeVisibility, () => document.visibilityState !== 'hidden');
}

/**
 * Phones: after "Mijn locatie" found the browser's position, a small own-position dot that follows it
 * (watchPosition) until the own tracker is live (its hunter marker shows where we are then). While the page is hidden
 * the watch pauses; the dot stays, faded, until the first fix after coming back. A rough fix (> 30 m) also draws its
 * accuracy circle.
 */
export default function BrowserLocationDot() {
  const { active, position, accuracy, fresh, setPosition, markStale, stop } = useBrowserLocationStore();
  const { status } = useTrackerStatus();
  const { positions, devices } = useDevices();
  const now = useNow(active, AGE_CLOCK_TICK_MS);
  const trackerLive = !!ownTrackerPosition(positions, ownDeviceId(devices, status?.configured ? status.uniqueId : undefined), now, OWN_POSITION_FRESH_MS);
  const watching = active && !trackerLive;
  const visible = usePageVisible();
  const { active: popup, open: openPopup, close: closePopup } = usePopupSelection<{ lng: number; lat: number; accuracy: number | null }>();

  useEffect(() => {
    if (active && trackerLive) stop();
  }, [active, trackerLive, stop]);

  // Hidden: no fixes come in, so the dot no longer shows where we are now
  useEffect(() => {
    if (!visible) markStale();
  }, [visible, markStale]);

  useEffect(() => {
    if (!watching || !visible || typeof navigator === 'undefined' || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (fix) => setPosition({ lat: fix.coords.latitude, lng: fix.coords.longitude }, fix.coords.accuracy),
      // A failed fix keeps the last dot; a denied permission ends it
      (error) => {
        if (error.code === error.PERMISSION_DENIED) stop();
      },
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [watching, visible, setPosition, stop]);

  // The last circle stays as the data while it fades out (the dot going, or the fix getting accurate)
  const circle = useMemo(() => (watching ? ownAccuracyCircle(position, accuracy) : null), [watching, position, accuracy]);
  const [shownCircle, setShownCircle] = useState(circle);
  if (circle?.features.length && circle !== shownCircle) setShownCircle(circle);
  const circleShown = watching && accuracy !== null && accuracy > OWN_ACCURACY_MIN_M;
  const paint = useMemo(() => accuracyPaint(circleShown), [circleShown]);

  return (
    <>
      {shownCircle && (
        <Source id={ACCURACY_SOURCE} type="geojson" data={shownCircle}>
          <Layer id="browser-location-accuracy-fill" type="fill" source={ACCURACY_SOURCE} paint={paint} />
        </Source>
      )}
      <AnimatePresence>{watching && position && <Dot key="dot" lng={position.lng} lat={position.lat} fresh={fresh} onOpen={() => openPopup({ ...position, accuracy })} />}</AnimatePresence>
      {popup && <OwnLocationPopup key={popup.opened} lng={popup.id.lng} lat={popup.id.lat} accuracy={popup.id.accuracy} onClose={closePopup} />}
    </>
  );
}
