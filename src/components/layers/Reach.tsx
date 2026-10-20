import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Layer, Marker, Source, type FillLayerSpecification, type LineLayerSpecification } from 'react-map-gl/maplibre';
import { useAreas } from '@/hooks/areas.hook';
import { useHuntableAreas } from '@/hooks/huntable-areas.hook';
import { useNow } from '@/hooks/now.hook';
import { useReach } from '@/hooks/reach.hook';
import { REACH_CONE_LAYER, REACH_FILL_LAYER, REACH_LINE_LAYER, REACH_SOURCE, reachChipText, reachFeatures, type AreaReach } from '@/lib/reach';
import { getColorFromArea } from '@/lib/utils';

const AREA_FILTER: FillLayerSpecification['filter'] = ['==', ['get', 'role'], 'area'];
const CONE_FILTER: FillLayerSpecification['filter'] = ['==', ['get', 'role'], 'cone'];
const LINE_FILTER: LineLayerSpecification['filter'] = ['==', ['get', 'role'], 'area'];
const FADE_MS = 250;
const FADE = { duration: FADE_MS, delay: 0 };

/**
 * Where each fox can have walked since its last hint/hunt (look A): its area lightly filled with a dashed edge, a darker
 * cone toward the nearest unvisited group, and a chip with the time since and the fox's speed. Stays mounted so turning
 * the layer off fades it out.
 */
export default function Reach({ visible }: { visible: boolean }) {
  const { areas } = useReach(visible);
  const { isVisible } = useAreas();
  const { isForbidden } = useHuntableAreas();
  const now = useNow(visible, 30_000);

  // Keep the last areas while fading out, then drop them
  const [kept, setKept] = useState<AreaReach[]>([]);
  if (visible && areas && areas !== kept) setKept(areas);
  useEffect(() => {
    if (visible) return;
    const timer = setTimeout(() => setKept([]), FADE_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  const shown = useMemo(() => kept.filter((reach) => isVisible(reach.area) && !isForbidden(reach.area)), [kept, isVisible, isForbidden]);
  const data = useMemo(() => reachFeatures(shown, getColorFromArea), [shown]);

  return (
    <>
      <Source id={REACH_SOURCE} type="geojson" data={data}>
        <Layer id={REACH_FILL_LAYER} type="fill" filter={AREA_FILTER}
               paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': visible ? 0.12 : 0, 'fill-opacity-transition': FADE }} />
        <Layer id={REACH_CONE_LAYER} type="fill" filter={CONE_FILTER}
               paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': visible ? 0.22 : 0, 'fill-opacity-transition': FADE }} />
        <Layer id={REACH_LINE_LAYER} type="line" filter={LINE_FILTER}
               paint={{ 'line-color': ['get', 'color'], 'line-width': 2, 'line-dasharray': [3, 2], 'line-opacity': visible ? 1 : 0, 'line-opacity-transition': FADE }} />
      </Source>
      <AnimatePresence>
        {visible && shown.map((reach) => (
          <Marker key={reach.area} longitude={reach.fix.lng} latitude={reach.fix.lat} anchor="left" offset={[-7, 0]} style={{ pointerEvents: 'none' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="flex origin-left items-center gap-1.5"
            >
              <span className="size-3.5 rounded-full shadow-md ring-[2.5px] ring-card" style={{ backgroundColor: getColorFromArea(reach.area) }} />
              <span className="rounded-full bg-card px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-foreground tabular-nums shadow-md">
                {reachChipText(reach, now)}
              </span>
            </motion.div>
          </Marker>
        ))}
      </AnimatePresence>
    </>
  );
}
