import { useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Source, useMap, type FillLayerSpecification, type SymbolLayerSpecification } from 'react-map-gl/maplibre';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { getLife360Avatar, useLife360Avatars } from '@/hooks/life360-avatar.hook';
import { useLife360Members } from '@/hooks/life360.hook';
import { life360AccuracyCircles, life360Features, parseLife360ImageId } from '@/lib/life360-map';
import { LIFE360_ACCURACY_LAYER, LIFE360_HOVER_LAYER, LIFE360_LAYER } from '@/lib/map-layers';
import type { Life360Member } from '@/types/Life360';
import { drawLife360Icon } from './life360/life360-icons';
import Life360Popup from './life360/Life360Popup';
import Life360Tooltip from './life360/Life360Tooltip';
import { mapImagePixelRatio } from './map-images';
import { featureId, useLayerInteractions, usePopupSelection } from './map-interactions';

const MEMBERS_SOURCE = 'life360';
const ACCURACY_SOURCE = 'life360-accuracy';
const NO_MEMBERS: Life360Member[] = [];
// The features carry the full image id (the images don't depend on the theme)
const LAYOUT: SymbolLayerSpecification['layout'] = { 'icon-image': ['get', 'icon'], 'icon-allow-overlap': true, 'icon-ignore-placement': true };
const HOVER_LAYOUT: SymbolLayerSpecification['layout'] = { ...LAYOUT, 'icon-size': 1.1 };
const ACCURACY_PAINT: FillLayerSpecification['paint'] = { 'fill-color': ['get', 'color'], 'fill-opacity': 0.14, 'fill-outline-color': ['get', 'color'] };
const INTERACTIVE_LAYERS = [LIFE360_LAYER];

/**
 * Draw and add the Life360 image `id` (see life360ImageId) unless the map has it.
 * @param avatarOf Member id → avatar path, to find a loaded photo
 * @returns whether `id` is a Life360 image
 */
function addLife360Image(map: MaplibreMap, id: string, avatarOf: (memberId: string) => string | null | undefined): boolean {
  const spec = parseLife360ImageId(id);
  if (!spec) return false;
  if (map.hasImage(id)) return true;
  const path = spec.photo ? avatarOf(spec.memberId) : undefined;
  const photo = path ? getLife360Avatar(path)?.image : undefined;
  const pixelRatio = mapImagePixelRatio();
  try {
    map.addImage(id, drawLife360Icon(spec, photo, pixelRatio), { pixelRatio });
  } catch {
    // No 2D canvas (iOS Safari's memory limit): this member has no marker until the next poll
  }
  return true;
}

/** Life360 members as their own map layer: avatar cookies, accuracy circles, hover tooltip and click popup. */
export default function Life360() {
  const { data } = useLife360Members(true);
  const map = useMap().current?.getMap();
  const members = data?.linked ? data.members : NO_MEMBERS;
  const linkStale = !!data?.stale;

  const avatarPaths = useMemo(() => members.flatMap((member) => (member.avatarUrl ? [member.avatarUrl] : [])), [members]);
  const loadedAvatars = useLife360Avatars(avatarPaths);
  // Staleness is decided on each poll (every 15 s), like the hunters
  const features = useMemo(() => life360Features(members, linkStale, (member) => !!member.avatarUrl && loadedAvatars.has(member.avatarUrl)), [members, linkStale, loadedAvatars]);
  const circles = useMemo(() => life360AccuracyCircles(members, linkStale), [members, linkStale]);

  // The image drawer looks up avatar paths through a ref, so the styleimagemissing listener stays subscribed
  const avatarOf = useRef(new Map<string, string | null>());
  useEffect(() => {
    avatarOf.current = new Map(members.map((member) => [member.id, member.avatarUrl]));
  }, [members]);

  // A style or theme switch drops the images: draw them again when the map asks
  useEffect(() => {
    if (!map) return;
    const onMissing = (e: { id: string }) => void addLife360Image(map, e.id, (id) => avatarOf.current.get(id));
    map.on('styleimagemissing', onMissing);
    return () => {
      map.off('styleimagemissing', onMissing);
    };
  }, [map]);

  // New looks (started driving, photo loaded, went stale): add them before the layer asks
  useEffect(() => {
    if (!map) return;
    for (const feature of features.features) addLife360Image(map, feature.properties.icon, (id) => avatarOf.current.get(id));
  }, [map, features]);

  const { active, open: openPopup, close: closePopup } = usePopupSelection<string>();
  const [hoveredId, setHoveredId] = useState<string>();
  // Derived from the current data so the popup and tooltip follow the member
  const activeMember = active ? members.find((member) => member.id === active.id) : undefined;
  const hoveredMember = hoveredId !== undefined && !activeMember ? members.find((member) => member.id === hoveredId) : undefined;
  const hoverFilter = useMemo<SymbolLayerSpecification['filter']>(() => ['==', ['get', 'id'], hoveredId ?? ''], [hoveredId]);

  useLayerInteractions(map, INTERACTIVE_LAYERS, {
    onClick: (feature) => {
      const id = featureId(feature);
      if (typeof id !== 'string') return;
      openPopup(id);
      setHoveredId(undefined);
    },
    onHover: (feature) => {
      const id = featureId(feature);
      setHoveredId(typeof id === 'string' ? id : undefined);
    },
  });

  if (!data?.linked) return null;

  return (
    <>
      <Source id={ACCURACY_SOURCE} type="geojson" data={circles}>
        <Layer id={LIFE360_ACCURACY_LAYER} type="fill" source={ACCURACY_SOURCE} paint={ACCURACY_PAINT} />
      </Source>
      <Source id={MEMBERS_SOURCE} type="geojson" data={features}>
        <Layer id={LIFE360_LAYER} type="symbol" source={MEMBERS_SOURCE} layout={LAYOUT} />
        <Layer id={LIFE360_HOVER_LAYER} type="symbol" source={MEMBERS_SOURCE} layout={HOVER_LAYOUT} filter={hoverFilter} />
      </Source>
      {hoveredMember?.location && <Life360Tooltip member={hoveredMember} location={hoveredMember.location} />}
      {active && activeMember?.location && <Life360Popup key={active.opened} member={activeMember} location={activeMember.location} linkStale={linkStale} onClose={closePopup} />}
    </>
  );
}
