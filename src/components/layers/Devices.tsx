import { useEffect, useMemo, useState } from 'react';
import { Layer, Source, useMap, type CircleLayerSpecification, type FillLayerSpecification, type SymbolLayerSpecification } from 'react-map-gl/maplibre';
import { useDevices } from '@/hooks/devices.hook';
import { vehicleForGroupId, vehicleGroupIdsFromEnv } from '@/lib/hunters';
import { accuracyCircles, HUNTER_ARROWS_LAYER, hunterFeatures, HUNTERS_LAYER, type HunterIcon } from '@/lib/map-layers';
import { isMoreThanFiveMinutesAgo } from '@/lib/utils';
import { featureId, useLayerInteractions, usePopupSelection } from './map-interactions';
import { addHunterImage, HUNTER_ARROW_IMAGE, loadHunterImages, type HunterImages } from './devices/hunter-images';
import DevicePopup from './devices/DevicePopup';
import DeviceTooltip from './devices/DeviceTooltip';

const GROUPS = vehicleGroupIdsFromEnv(import.meta.env);

/** Icon for a Traccar group: the vehicle's icon, or a phone when the group isn't a configured vehicle */
function iconForGroup(groupId: number): HunterIcon {
  return vehicleForGroupId(groupId, GROUPS) ?? 'phone';
}

const ACCURACY_SOURCE = 'device-accuracy';
const ACCURACY_PAINT: FillLayerSpecification['paint'] = {
  'fill-color': 'rgba(66, 135, 245, 0.2)',
  'fill-outline-color': 'rgba(66, 135, 245, 0.5)',
};

// All hunters are one GeoJSON source (updated every poll) with symbol layers instead of an HTML marker each
const HUNTERS_SOURCE = 'hunters';
const HUNTERS_HOVER_LAYER = 'hunters-hover';
const HUNTERS_LAYOUT: SymbolLayerSpecification['layout'] = { 'icon-image': ['get', 'icon'], 'icon-allow-overlap': true, 'icon-ignore-placement': true };
// Like the former HTML marker's hover: brighter (the hover image) and 5% larger
const HUNTERS_HOVER_LAYOUT: SymbolLayerSpecification['layout'] = { ...HUNTERS_LAYOUT, 'icon-image': ['get', 'hoverIcon'], 'icon-size': 1.05 };
// Heading arrow 30px from the hunter towards its course, pointing along it (screen-aligned, like the HTML arrow)
const ARROWS_LAYOUT: SymbolLayerSpecification['layout'] = {
  'icon-image': HUNTER_ARROW_IMAGE,
  'icon-rotate': ['get', 'course'],
  'icon-offset': [0, -30],
  'icon-rotation-alignment': 'viewport',
  'icon-allow-overlap': true,
  'icon-ignore-placement': true,
};
const ARROWS_FILTER: SymbolLayerSpecification['filter'] = ['==', ['get', 'moving'], true];
// Only when the icons could not be rasterised: plain dots, so the hunters never disappear
const HUNTERS_FALLBACK_PAINT: CircleLayerSpecification['paint'] = { 'circle-radius': 9, 'circle-color': '#1473e8', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' };
// Clicking the arrow is clicking the hunter, like the former HTML marker (the arrow was part of it)
const HUNTERS_INTERACTIVE_LAYERS = [HUNTERS_LAYER, HUNTER_ARROWS_LAYER];

export default function Devices() {
  const { positions, devices } = useDevices();
  const map = useMap().current?.getMap();
  const [icons, setIcons] = useState<'loading' | 'ready' | 'failed'>('loading');

  // Device id 0 is valid, hence the `!== undefined` checks
  const { active, open: openPopup, close: closePopup } = usePopupSelection<number>();
  const [hoveredId, setHoveredId] = useState<number>();
  // Derived from the current data so the popup and tooltip follow the device
  const activeDevice = active ? positions?.find((position) => position.deviceId === active.id) : undefined;
  // No hover tooltips while a device popup is open
  const hoveredDevice = hoveredId !== undefined && !activeDevice ? positions?.find((position) => position.deviceId === hoveredId) : undefined;

  /** Device id -> icon for its vehicle group (phone when the group isn't a vehicle) */
  const iconByDevice = useMemo(() => new Map((devices ?? []).map((device) => [device.id, iconForGroup(device.groupId)])), [devices]);
  const circles = useMemo(() => accuracyCircles(positions ?? []), [positions]);
  // Stale (greyed out) is decided on each poll, like before
  const features = useMemo(() => hunterFeatures(positions ?? [], (deviceId) => iconByDevice.get(deviceId) ?? 'phone', isMoreThanFiveMinutesAgo), [positions, iconByDevice]);
  const hoverFilter = useMemo<SymbolLayerSpecification['filter']>(() => ['==', ['get', 'id'], hoveredId ?? -1], [hoveredId]);

  // Hunter icons as map images; variants (grey, hovered) and a style switch go through styleimagemissing
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    let images: HunterImages | undefined;
    const onMissing = (e: { id: string }) => {
      if (images) addHunterImage(map, images, e.id);
    };
    map.on('styleimagemissing', onMissing);
    loadHunterImages()
      .then((loaded) => {
        if (cancelled) return;
        images = loaded;
        addHunterImage(map, loaded, HUNTER_ARROW_IMAGE);
        setIcons('ready');
      })
      .catch(() => !cancelled && setIcons('failed'));
    return () => {
      cancelled = true;
      map.off('styleimagemissing', onMissing);
    };
  }, [map]);

  // Click → popup, hover → tooltip + brighter, slightly larger icon
  useLayerInteractions(map, HUNTERS_INTERACTIVE_LAYERS, {
    onClick: (feature) => {
      const id = featureId(feature);
      if (typeof id !== 'number') return;
      openPopup(id);
      setHoveredId(undefined);
    },
    onHover: (feature) => {
      const id = featureId(feature);
      setHoveredId(typeof id === 'number' ? id : undefined);
    },
  });

  return (
    <>
      <Source id={ACCURACY_SOURCE} type="geojson" data={circles}>
        <Layer id="device-accuracy-fill" type="fill" source={ACCURACY_SOURCE} paint={ACCURACY_PAINT} />
      </Source>
      {icons !== 'loading' && (
        <Source id={HUNTERS_SOURCE} type="geojson" data={features}>
          {icons === 'ready' && <Layer id={HUNTER_ARROWS_LAYER} type="symbol" source={HUNTERS_SOURCE} layout={ARROWS_LAYOUT} filter={ARROWS_FILTER} />}
          {icons === 'ready' ? (
            <Layer id={HUNTERS_LAYER} type="symbol" source={HUNTERS_SOURCE} layout={HUNTERS_LAYOUT} />
          ) : (
            <Layer id={HUNTERS_LAYER} type="circle" source={HUNTERS_SOURCE} paint={HUNTERS_FALLBACK_PAINT} />
          )}
          {icons === 'ready' && <Layer id={HUNTERS_HOVER_LAYER} type="symbol" source={HUNTERS_SOURCE} layout={HUNTERS_HOVER_LAYOUT} filter={hoverFilter} />}
        </Source>
      )}
      {hoveredDevice && <DeviceTooltip position={hoveredDevice} />}
      {activeDevice && <DevicePopup key={active!.opened} position={activeDevice} onClose={closePopup} />}
    </>
  );
}
