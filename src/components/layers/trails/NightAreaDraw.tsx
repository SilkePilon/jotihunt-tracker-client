import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Layer, Source, useMap, type CircleLayerSpecification, type FillLayerSpecification, type LineLayerSpecification } from 'react-map-gl/maplibre';
import type { Map as MaplibreMap, MapMouseEvent } from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';
import { AnimatePresence, motion, useIsPresent } from 'motion/react';
import { Loader2Icon, Undo2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Pill, IconPill } from '@/components/beheer/controls/Pill';
import ConfirmDialog from '@/components/ConfirmDialog';
import InlineError from '@/components/InlineError';
import Reveal from '@/components/motion/Reveal';
import Segmented, { type SegmentOption } from '@/components/beheer/controls/Segmented';
import { useNightAreas } from '@/hooks/night-areas.hook';
import { useIsMobile } from '@/hooks/media.hook';
import { NIGHT_DRAW_LAYERS, NIGHT_FILL, NIGHT_LINE } from '@/lib/map-layers';
import { SWAP, SWAP_TRANSITION } from '@/lib/motion';
import { CLOSED_MESSAGE, drawHint, droppedMessage, KEYBOARD_DRAW_HINT, MOVE_FIRST_MESSAGE, NAME_MISSING_MESSAGE, nudgeDelta, UNDO_MESSAGE } from '@/lib/night-draw-keys';
import { activatedByKeyboard } from '@/lib/input-modality';
import { belowSafeArea, desktopToolbarTop, phoneTopStack } from '@/lib/top-stack';
import useAdminStore from '@/stores/admin.store';
import { ringFromPoints, useNightDraw } from '@/stores/night-draw.store';
import useSidebarStore from '@/stores/sidebar.store';
import useTopStackStore, { usePublishTopHeight } from '@/stores/top-stack.store';
import type { NightAreaKind } from '@/types/Trail';

const SOURCE = 'night-draw';
const [FILL_LAYER, LINE_LAYER, VERTICES_LAYER] = NIGHT_DRAW_LAYERS;
/** A tap this close (px) to the last corner (the second tap of a double tap) or the first corner closes the ring */
const CLOSE_PX = 10;

const KIND_OPTIONS: SegmentOption<NightAreaKind>[] = [
  { value: 'closed', label: "Dicht 's nachts", selectedClassName: 'bg-fox-error-container', selectedTextClassName: 'text-fox-on-error' },
  { value: 'open', label: "Open 's nachts", selectedClassName: 'bg-fox-ok-container', selectedTextClassName: 'text-fox-on-ok' },
];

/** Keep a nudged corner this far (px) inside the map's edge; past it the map pans along */
const NUDGE_EDGE_PX = 40;

/** ConfirmDialog's close animation (data-[state=closed]:duration-150) plus a margin, before draw mode unmounts it */
const CONFIRM_CLOSE_MS = 180;

/** Give up waiting for Beheer to close (keyboard start) after this long */
const FOCUS_WAIT_MS = 2000;

/** A mouse or trackpad: the hint also names the keyboard way in */
const finePointer = () => typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;

/**
 * Keyboard drawing: where Enter drops the next corner, the middle of the map (its padded centre, like getCenter()).
 * Follows resizes and padding changes; decorative (the live region says what happens).
 */
function CenterCrosshair({ map, color }: { map: MaplibreMap; color: string }) {
  const [at, setAt] = useState(() => map.project(map.getCenter()));
  useEffect(() => {
    const update = () => setAt(map.project(map.getCenter()));
    map.on('move', update);
    map.on('resize', update);
    return () => {
      map.off('move', update);
      map.off('resize', update);
    };
  }, [map]);
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute z-10 size-7 -translate-x-1/2 -translate-y-1/2"
      style={{ left: at.x, top: at.y }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={SWAP_TRANSITION}
    >
      <svg viewBox="0 0 28 28" className="size-full overflow-visible" fill="none" strokeLinecap="round">
        {/* White halo under the line colour, so it reads on light and dark tiles */}
        <g stroke="#ffffff" strokeWidth={4.5}>
          <circle cx={14} cy={14} r={6} />
          <path d="M14 1v6M14 21v6M1 14h6M21 14h6" />
        </g>
        <g stroke={color} strokeWidth={2}>
          <circle cx={14} cy={14} r={6} />
          <path d="M14 1v6M14 21v6M1 14h6M21 14h6" />
        </g>
      </svg>
    </motion.div>
  );
}

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
  // Opslaan was pressed without a name: said under the field (and the field marked) until a name is typed
  const [nameMissing, setNameMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  // Annuleren / Escape with corners drawn asks first: they can't be brought back
  const [confirmLeave, setConfirmLeave] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(leaveTimer.current), []);
  const isMobile = useIsMobile();
  // Phones: the hint sits above the bottom sheet
  const sheetHeight = useSidebarStore((state) => state.sheetHeight);
  // The toolbar sits below the status messages (offline badge, happy-hour pill); phone toasts below the toolbar
  const isPresent = useIsPresent();
  const toolbarRef = usePublishTopHeight('toolbar', isPresent);
  const toolbarTop = useTopStackStore((state) => phoneTopStack(state.heights).toolbarTop);
  const toolbarTopMd = useTopStackStore((state) => desktopToolbarTop(state.heights.pill));
  // Keyboard drawing (lib/night-draw-keys.ts): the map has keyboard focus, and what the live region last said. `n` makes
  // the same sentence twice still a change, so it is read out again
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const [said, setSaid] = useState({ text: '', n: 0 });
  const [fine] = useState(finePointer);

  // Started from the keyboard (Gebied tekenen with Enter): the map takes focus once Beheer has closed and given focus
  // back, so Enter drops corners right away instead of the focus being lost on the page
  useEffect(() => {
    if (!map || !activatedByKeyboard()) return;
    const startedAt = performance.now();
    let frame = 0;
    const tryFocus = () => {
      if (useAdminStore.getState().dialog === null && !document.querySelector('[role="dialog"]')) {
        map.getCanvas().focus();
        setKeyboardFocus(true);
        return;
      }
      if (performance.now() - startedAt < FOCUS_WAIT_MS) frame = requestAnimationFrame(tryFocus);
    };
    frame = requestAnimationFrame(tryFocus);
    return () => cancelAnimationFrame(frame);
  }, [map]);

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

  // Keyboard alternative to tapping: Enter drops a corner in the middle of the map, arrows nudge the last one, Enter on an
  // unmoved corner closes, Backspace undoes. Captured on the canvas container, before MapLibre's own arrow-key panning
  useEffect(() => {
    if (!map) return;
    const container = map.getCanvasContainer();
    const canvas = map.getCanvas();
    // The corner Enter dropped last. While it is still the last corner, unmoved (moveLast and taps make new arrays),
    // another Enter closes, like a double tap
    let dropped: [number, number] | null = null;
    const say = (text: string) => setSaid((prev) => ({ text, n: prev.n + 1 }));
    const handled = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const state = useNightDraw.getState();
      if (!state.active || state.closed) return;
      if (e.key === 'Enter') {
        handled(e);
        if (dropped && state.points.at(-1) === dropped) {
          if (state.points.length >= 3) {
            state.close();
            say(CLOSED_MESSAGE);
          } else say(MOVE_FIRST_MESSAGE);
          return;
        }
        const center = map.getCenter();
        dropped = [center.lng, center.lat];
        state.addPoint(dropped);
        say(droppedMessage(state.points.length + 1));
        return;
      }
      if (e.key === 'Backspace') {
        if (!state.points.length) return;
        handled(e);
        state.undo();
        say(UNDO_MESSAGE);
        return;
      }
      const delta = nudgeDelta(e.key, e.shiftKey);
      const last = state.points.at(-1);
      // No corner yet: the arrows pan the map as usual, to pick the spot for the first one
      if (!delta || !last) return;
      handled(e);
      const at = map.project(last);
      const next = map.unproject([at.x + delta[0], at.y + delta[1]]);
      state.moveLast([next.lng, next.lat]);
      // Near the edge the map pans along, so the corner stays in view
      const { clientWidth: width, clientHeight: height } = canvas;
      const x = at.x + delta[0];
      const y = at.y + delta[1];
      if (x < NUDGE_EDGE_PX || y < NUDGE_EDGE_PX || x > width - NUDGE_EDGE_PX || y > height - NUDGE_EDGE_PX) map.panBy(delta, { duration: 150 });
    };
    // The hint shows the keys only while the map has keyboard focus (a mouse click on the map focuses it too)
    const onFocus = () => setKeyboardFocus(canvas.matches(':focus-visible'));
    const onBlur = () => setKeyboardFocus(false);
    container.addEventListener('keydown', onKeyDown, { capture: true });
    canvas.addEventListener('focus', onFocus);
    canvas.addEventListener('blur', onBlur);
    return () => {
      container.removeEventListener('keydown', onKeyDown, { capture: true });
      canvas.removeEventListener('focus', onFocus);
      canvas.removeEventListener('blur', onBlur);
    };
  }, [map]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Escape inside the confirm closes only that dialog (it is still in the DOM while this listener runs)
      if (e.key !== 'Escape' || !useNightDraw.getState().active || document.querySelector('[role="alertdialog"]')) return;
      requestLeave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /** Annuleren: straight back without corners, otherwise after "Weggooien" in the confirm */
  function requestLeave() {
    // Already leaving after Weggooien
    if (leaveTimer.current) return;
    if (useNightDraw.getState().points.length) setConfirmLeave(true);
    else leave();
  }

  /** Weggooien: let the confirm close with its animation, then leave draw mode (which unmounts it) */
  function confirmDiscard() {
    setConfirmLeave(false);
    leaveTimer.current = setTimeout(leave, CONFIRM_CLOSE_MS);
  }

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
      setNameMissing(true);
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
            ref={toolbarRef}
            role="group"
            aria-label="Nachtgebied tekenen"
            style={{ '--toolbar-top': belowSafeArea(toolbarTop), '--toolbar-top-md': `${toolbarTopMd}px` } as React.CSSProperties}
            className="fixed top-(--toolbar-top) left-1/2 z-40 flex max-w-[calc(100vw-16px)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-card p-1.5 shadow-[0_0_0_1px_var(--border),0_8px_24px_rgb(0_0_0/0.18)] transition-[top] duration-300 ease-out motion-reduce:transition-none md:top-(--toolbar-top-md) md:left-[calc(50%+164px)]"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={SWAP_TRANSITION}
          >
            <Segmented label="Soort gebied" value={kind} options={KIND_OPTIONS} onChange={setKind} />
            <IconPill variant="soft" aria-label="Ongedaan maken" title="Ongedaan maken" disabled={!points.length || saving} onClick={undo} className="size-8">
              <Undo2Icon />
            </IconPill>
            <Pill variant="secondary" onClick={requestLeave} disabled={saving}>
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
                    onChange={(e) => {
                      setName(e.target.value);
                      if (e.target.value.trim()) setNameMissing(false);
                    }}
                    placeholder="Naam, bv. Posbank noord"
                    aria-label="Naam van het gebied"
                    aria-invalid={nameMissing || undefined}
                    aria-describedby={nameMissing ? 'night-area-name-error' : undefined}
                    maxLength={60}
                    autoFocus
                    className="h-10 w-[min(280px,calc(100vw-32px))] rounded-xl bg-card px-3.5 text-base shadow-[0_0_0_1px_var(--input),0_8px_24px_rgb(0_0_0/0.18)] md:text-[13px] outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring aria-invalid:shadow-[0_0_0_1px_var(--destructive),0_8px_24px_rgb(0_0_0/0.18)] aria-invalid:focus-visible:ring-destructive/40"
                  />
                  <Reveal>
                    {nameMissing && (
                      <div id="night-area-name-error" className="mt-1.5 w-fit rounded-lg bg-card px-2.5 py-1 shadow-[0_0_0_1px_var(--border)]">
                        <InlineError role="alert">{NAME_MISSING_MESSAGE}</InlineError>
                      </div>
                    )}
                  </Reveal>
                </motion.form>
              ) : (
                <motion.div key={keyboardFocus ? 'keys' : 'hint'} {...SWAP} className="rounded-[10px] bg-[rgb(12_10_9/0.82)] px-3 py-1.5 text-xs whitespace-nowrap text-white">
                  {keyboardFocus ? KEYBOARD_DRAW_HINT : drawHint(fine)}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          {/* Always mounted, so each keyboard step is read out (a freshly mounted region often isn't) */}
          <div role="status" aria-live="polite" className="sr-only">
            {said.text}
            {said.n % 2 ? '\u00a0' : ''}
          </div>
        </>,
        document.body,
      )}
      {/* Keyboard drawing: where Enter puts the next corner. In the map container, under the map's own controls */}
      {map &&
        createPortal(
          <AnimatePresence>{keyboardFocus && !closed && <CenterCrosshair key="crosshair" map={map} color={NIGHT_LINE[kind]} />}</AnimatePresence>,
          map.getContainer(),
        )}
      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title="Tekening weggooien?"
        description={`Je ${points.length === 1 ? 'getekende punt gaat' : `${points.length} getekende punten gaan`} verloren. Het gebied is nog niet opgeslagen.`}
        cancelLabel="Verder tekenen"
        confirmLabel="Weggooien"
        destructive
        onConfirm={confirmDiscard}
      />
    </>
  );
}
