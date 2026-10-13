import { useMemo, useState } from 'react';
import { Layer, Source, useMap, type FillLayerSpecification, type SymbolLayerSpecification } from 'react-map-gl/maplibre';
import { useDevices } from '@/hooks/devices.hook';
import { vehicleForGroupId, vehicleGroupIdsFromEnv } from '@/lib/hunters';
import { accuracyCircles, HUNTER_ARROWS_LAYER, hunterFeatures, HUNTERS_LAYER, type HunterIcon } from '@/lib/map-layers';
import { isMoreThanFiveMinutesAgo } from '@/lib/utils';
import { markerIconId, themedIconExpression, themedImageId, type MarkerPalette, type MarkerTheme } from '@/lib/marker-style';
import { featureId, useLayerInteractions, usePopupSelection } from './map-interactions';
import { useMarkerPalette, useMarkerTheme } from './marker-icons';
import DevicePopup from './devices/DevicePopup';
import DeviceTooltip from './devices/DeviceTooltip';

const GROUPS = vehicleGroupIdsFromEnv(import.meta.env);

/** Icon for a Traccar group: the vehicle's icon, or a phone when the group isn't a configured vehicle */
function iconForGroup(groupId: number): HunterIcon {
  return vehicleForGroupId(groupId, GROUPS) ?? 'phone';
}

const ACCURACY_SOURCE = 'device-accuracy';
// Like the Android app: the hunters' secondary colour at 12%
function accuracyPaint(palette: MarkerPalette): FillLayerSpecification['paint'] {
  return { 'fill-color': palette.secondary, 'fill-opacity': 0.12, 'fill-outline-color': palette.secondary };
}

// All hunters are one GeoJSON source (updated every poll) with symbol layers instead of an HTML marker each
const HUNTERS_SOURCE = 'hunters';
const HUNTERS_HOVER_LAYER = 'hunters-hover';
function huntersLayout(theme: MarkerTheme): SymbolLayerSpecification['layout'] {
  return { 'icon-image': themedIconExpression(theme), 'icon-allow-overlap': true, 'icon-ignore-placement': true };
}
// Heading arrow 30px from the hunter towards its course, pointing along it (screen-aligned, like the Android app)
function arrowsLayout(theme: MarkerTheme): SymbolLayerSpecification['layout'] {
  return {
    'icon-image': themedImageId(theme, markerIconId({ kind: 'arrow' })),
    'icon-rotate': ['get', 'course'],
    'icon-offset': [0, -30],
    'icon-rotation-alignment': 'viewport',
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  };
}
const ARROWS_FILTER: SymbolLayerSpecification['filter'] = ['==', ['get', 'moving'], true];
// Clicking the arrow is clicking the hunter, like the former HTML marker (the arrow was part of it)
const HUNTERS_INTERACTIVE_LAYERS = [HUNTERS_LAYER, HUNTER_ARROWS_LAYER];

export default function Devices() {
  const { positions, devices } = useDevices();
  const map = useMap().current?.getMap();
  const theme = useMarkerTheme();
  const palette = useMarkerPalette();
  const layout = useMemo(() => huntersLayout(theme), [theme]);
  // Hovered: 10% larger
  const hoverLayout = useMemo<SymbolLayerSpecification['layout']>(() => ({ ...layout, 'icon-size': 1.1 }), [layout]);
  const arrows = useMemo(() => arrowsLayout(theme), [theme]);
  const accuracy = useMemo(() => accuracyPaint(palette), [palette]);

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

  // Click → popup, hover → tooltip + slightly larger icon
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
        <Layer id="device-accuracy-fill" type="fill" source={ACCURACY_SOURCE} paint={accuracy} />
      </Source>
      <Source id={HUNTERS_SOURCE} type="geojson" data={features}>
        <Layer id={HUNTER_ARROWS_LAYER} type="symbol" source={HUNTERS_SOURCE} layout={arrows} filter={ARROWS_FILTER} />
        <Layer id={HUNTERS_LAYER} type="symbol" source={HUNTERS_SOURCE} layout={layout} />
        <Layer id={HUNTERS_HOVER_LAYER} type="symbol" source={HUNTERS_SOURCE} layout={hoverLayout} filter={hoverFilter} />
      </Source>
      {hoveredDevice && <DeviceTooltip position={hoveredDevice} />}
      {activeDevice && <DevicePopup key={active!.opened} position={activeDevice} icon={iconByDevice.get(activeDevice.deviceId) ?? 'phone'} onClose={closePopup} />}
    </>
  );
}
