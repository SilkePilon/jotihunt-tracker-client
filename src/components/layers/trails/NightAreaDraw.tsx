import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Layer, Source, useMap, type CircleLayerSpecification, type FillLayerSpecification, type LineLayerSpecification } from 'react-map-gl/maplibre';
import type { MapMouseEvent } from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2Icon, Undo2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Pill, IconPill } from '@/components/beheer/controls/Pill';
import Segmented, { type SegmentOption } from '@/components/beheer/controls/Segmented';
import { useNightAreas } from '@/hooks/night-areas.hook';
import { useIsMobile } from '@/hooks/media.hook';
import { NIGHT_DRAW_LAYERS, NIGHT_FILL, NIGHT_LINE } from '@/lib/map-layers';
import { SWAP, SWAP_TRANSITION } from '@/lib/motion';
import useAdminStore from '@/stores/admin.store';
import { ringFromPoints, useNightDraw } from '@/stores/night-draw.store';
import useSidebarStore from '@/stores/sidebar.store';
import type { NightAreaKind } from '@/types/Trail';

const SOURCE = 'night-draw';
const [FILL_LAYER, LINE_LAYER, VERTICES_LAYER] = NIGHT_DRAW_LAYERS;
/** A tap this close (px) to the last corner (the second tap of a double tap) or the first corner closes the ring */
const CLOSE_PX = 10;

const KIND_OPTIONS: SegmentOption<NightAreaKind>[] = [
  { value: 'closed', label: "Dicht 's nachts", selectedClassName: 'bg-[#ffdad6]', selectedTextClassName: 'text-[#93000a]' },
  { value: 'open', label: "Open 's nachts", selectedClassName: 'bg-[rgb(27_109_47/0.12)]', selectedTextClassName: 'text-[#1b6d2f]' },
];

/** Back to Beheer → Algemeen (the Routes card) */
function leave() {
  useNightDraw.getState().cancel();
  useAdminStore.getState().openDialog('algemeen');
}

/**
 * Draw mode for an own night area (Beheer → Routes → "Gebied tekenen"): tap corners on the map, double tap (or tap the
 * first corner) to close the ring, name it and save. A floating bar on top holds the kind and the actions, a pill at the
 * bottom the hint and then the name input. Rendered inside the Map (admins, not on the HQ wall) while drawing.
 */
export default function NightAreaDraw() {
  const map = useMap().current?.getMap();
  const { kind, points, closed, setKind, undo } = useNightDraw();
  const { setting, save } = useNightAreas();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const isMobile = useIsMobile();
  // Phones: the hint sits above the bottom sheet
  const sheetHeight = useSidebarStore((state) => state.sheetHeight);

  useEffect(() => {
    if (!map) return;
    const canvas = map.getCanvas();
    const previousCursor = canvas.style.cursor;
    canvas.style.cursor = 'crosshair';
    map.doubleClickZoom.disable();

    const onClick = (e: MapMouseEvent) => {
      const state = useNightDraw.getState();
      if (!state.active || state.closed) return;
      const near = (p: [number, number] | undefined) => {
        if (!p) return false;
        const at = map.project(p);
        return Math.hypot(at.x - e.point.x, at.y - e.point.y) < CLOSE_PX;
      };
      // The second click of a double click (or a double tap, which touch browsers don't report as dblclick) lands on
      // the corner the first one just added; tapping the first corner closes too
      if (near(state.points.at(-1)) || (state.points.length >= 3 && near(state.points[0]))) {
        state.close();
        return;
      }
      state.addPoint([e.lngLat.lng, e.lngLat.lat]);
    };
    const onDblClick = (e: MapMouseEvent) => {
      e.preventDefault();
      useNightDraw.getState().close();
    };
    map.on('click', onClick);
    map.on('dblclick', onDblClick);
    return () => {
      map.off('click', onClick);
      map.off('dblclick', onDblClick);
      map.doubleClickZoom.enable();
      canvas.style.cursor = previousCursor;
    };
  }, [map]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useNightDraw.getState().active) leave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const data = useMemo<FeatureCollection<Polygon | LineString | Point>>(() => {
    const ring = ringFromPoints(points);
    const shape: Feature<Polygon | LineString>[] = ring
      ? [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }]
      : points.length === 2
        ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points } }]
        : [];
    const corners: Feature<Point>[] = points.map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } }));
    return { type: 'FeatureCollection', features: [...shape, ...corners] };
  }, [points]);

  const fillPaint: FillLayerSpecification['paint'] = { 'fill-color': NIGHT_FILL[kind], 'fill-color-transition': { duration: 200, delay: 0 } };
  const linePaint: LineLayerSpecification['paint'] = { 'line-color': NIGHT_LINE[kind], 'line-width': 2.5, 'line-dasharray': [2, 1.5] };
  const vertexPaint: CircleLayerSpecification['paint'] = { 'circle-radius': 5, 'circle-color': '#ffffff', 'circle-stroke-width': 2.5, 'circle-stroke-color': NIGHT_LINE[kind] };

  async function submit() {
    const ring = ringFromPoints(points);
    if (!closed || !ring || saving) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Geef het gebied een naam');
      return;
    }
    if (!setting) {
      toast.error('Opslaan mislukt');
      return;
    }
    setSaving(true);
    try {
      await save({
        ...setting,
        areas: [...setting.areas, { id: crypto.randomUUID().slice(0, 12), name: trimmed, kind, polygon: { type: 'Polygon', coordinates: [ring] } }],
      });
      toast.success('Gebied opgeslagen');
      leave();
    } catch {
      toast.error('Opslaan mislukt');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Source id={SOURCE} type="geojson" data={data}>
        <Layer id={FILL_LAYER} type="fill" filter={['==', ['geometry-type'], 'Polygon']} paint={fillPaint} />
        <Layer id={LINE_LAYER} type="line" filter={['!=', ['geometry-type'], 'Point']} layout={{ 'line-join': 'round' }} paint={linePaint} />
        <Layer id={VERTICES_LAYER} type="circle" filter={['==', ['geometry-type'], 'Point']} paint={vertexPaint} />
      </Source>
      {/* In the body, not in the map container: MapLibre listens there natively, so clicks on the bar would add corners */}
      {createPortal(
        <>
          <motion.div
            role="toolbar"
            aria-label="Nachtgebied tekenen"
            className="fixed top-[calc(env(safe-area-inset-top)+12px)] left-1/2 z-40 flex max-w-[calc(100vw-16px)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-card p-1.5 shadow-[0_0_0_1px_var(--border),0_8px_24px_rgb(0_0_0/0.18)] md:top-[56px] md:left-[calc(50%+164px)]"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={SWAP_TRANSITION}
          >
            <Segmented label="Soort gebied" value={kind} options={KIND_OPTIONS} onChange={setKind} />
            <IconPill variant="soft" aria-label="Ongedaan maken" title="Ongedaan maken" disabled={!points.length || saving} onClick={undo} className="size-8">
              <Undo2Icon />
            </IconPill>
            <Pill variant="secondary" onClick={leave} disabled={saving}>
              Annuleren
            </Pill>
            <Pill variant="primary" morphKey={saving ? 'busy' : 'idle'} disabled={!closed || saving} onClick={() => void submit()}>
              {saving && <Loader2Icon className="animate-spin" />}
              Opslaan
            </Pill>
          </motion.div>
          <motion.div
            className="fixed left-1/2 z-40 -translate-x-1/2 md:left-[calc(50%+164px)]"
            style={{ bottom: isMobile ? sheetHeight + 12 : 16 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SWAP_TRANSITION}
          >
            <AnimatePresence mode="wait" initial={false}>
              {closed ? (
                <motion.form
                  key="name"
                  {...SWAP}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                  }}
                >
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Naam, bv. Posbank noord"
                    aria-label="Naam van het gebied"
                    maxLength={60}
                    autoFocus
                    className="h-10 w-[min(280px,calc(100vw-32px))] rounded-xl bg-card px-3.5 text-[13px] shadow-[0_0_0_1px_var(--border),0_8px_24px_rgb(0_0_0/0.18)] outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  />
                </motion.form>
              ) : (
                <motion.div key="hint" {...SWAP} className="rounded-[10px] bg-[rgb(12_10_9/0.82)] px-3 py-1.5 text-xs whitespace-nowrap text-white">
                  Tik punten op de kaart · dubbeltik om te sluiten
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>,
        document.body,
      )}
    </>
  );
}
