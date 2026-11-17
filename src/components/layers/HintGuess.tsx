import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Feature, FeatureCollection, Polygon } from 'geojson';
import { CheckIcon, LightbulbIcon } from 'lucide-react';
import { Layer, Marker, Source, useMap, type FillLayerSpecification, type LineLayerSpecification } from 'react-map-gl/maplibre';
import { useIsMobile } from '@/hooks/media.hook';
import { useMarkers } from '@/hooks/markers.hook';
import { useDarkMode } from '@/hooks/utils/darkmode.hook';
import {
  guessBounds, guessShapes, type GuessShapeProps, HINT_GUESS_AREA_FILL_LAYER, HINT_GUESS_AREA_LINE_LAYER, HINT_GUESS_REACH_LAYER,
  HINT_GUESS_SOURCE, lastFoxFix, parseGuess, previewPoint, rankGuess,
} from '@/lib/hint-guess';
import { POP } from '@/lib/motion';
import { spacedHitDiameters } from '@/lib/hit-spacing';
import { INTEL_CLOSE_MS } from '@/lib/intel-window';
import { cn } from '@/lib/utils';
import { zoomScaled } from '@/lib/zoom-scale';
import useHintGuessStore from '@/stores/hint-guess.store';
import useSidebarStore, { type SheetSnap } from '@/stores/sidebar.store';

/** The map's padding ease after the phone sheet moves (Map.tsx easeTo 300 ms), plus a little slack */
const SHEET_EASE_MS = 350;
const AREA_FILTER: FillLayerSpecification['filter'] = ['==', ['get', 'role'], 'area'];
const REACH_FILTER: LineLayerSpecification['filter'] = ['==', ['get', 'role'], 'reach'];
/** Fade of the rectangle and the reach circle (paint *-opacity-transition) */
const SHAPE_FADE_MS = 200;
const SHAPE_FADE = { duration: SHAPE_FADE_MS, delay: 0 };
/** Dot tap targets: 44px on touch, 32px with a mouse; both shrink so neighbouring dots' targets never overlap */
const COARSE_HIT_PX = 44;
/** The dot's own size: a hit area is never smaller than the dot */
const DOT_PX = 22;
const ROLE_SCALE = { best: 1.25, out: 0.9, in: 1 } as const;

type Shape = Feature<Polygon, GuessShapeProps>;

/** Focus that sat in the phone sheet when lowering it made the sheet inert: where to bring it back after a pick */
interface SheetFocus {
  /** The snap before lowering it, to raise it back to */
  snap: SheetSnap;
  /** The element that had focus (a digit box) */
  element: HTMLElement;
}

/** Whether focus is gone (body), or on a guess dot / the map: then a pick (or a dropped guess) may move it back */
function focusIsOnMapOrLost(canvas: HTMLElement | undefined): boolean {
  const active = document.activeElement;
  return !active || active === document.body || active === canvas || !!active.closest('[data-guess-dot]');
}

/** Back in the raised sheet: Registreren when the filled-in hint can be sent, else the X digit boxes (or where it was). */
function focusHintForm(saved: SheetFocus) {
  if (!saved.element.isConnected) return;
  const form = saved.element.closest('form');
  const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
  const x = form?.querySelector<HTMLElement>('input[id$="-x"]');
  const target = submit && !submit.disabled ? submit : (x ?? saved.element);
  target.focus();
}

/**
 * A shape that fades: while it is gone, the last one stays as data (at opacity 0) for the fade-out, then is dropped.
 * @returns the shape to draw (current or fading out) and whether it should be visible
 */
function useFadingShape(shape: Shape | null): { data: Shape | null; visible: boolean } {
  const [kept, setKept] = useState(shape);
  if (shape && shape !== kept) setKept(shape);
  useEffect(() => {
    if (shape) return;
    const timer = setTimeout(() => setKept(null), SHAPE_FADE_MS);
    return () => clearTimeout(timer);
  }, [shape]);
  return { data: shape ?? kept, visible: !!shape };
}

/**
 * The partly solved hint being typed (hint card or Intel row): numbered candidate dots (tap = fill in that digit), or
 * the rectangle of everything that could match, plus the red dashed reach of the fox since its last known spot.
 * A complete coordinate typed in the hint card shows as one preview pin.
 */
export default function HintGuess() {
  const input = useHintGuessStore((state) => state.input);
  const pick = useHintGuessStore((state) => state.pick);
  const clear = useHintGuessStore((state) => state.clear);
  const { markers } = useMarkers();
  const dark = useDarkMode();
  const map = useMap().current;
  const isMobile = useIsMobile();

  const guess = useMemo(() => (input ? parseGuess(input.x, input.y) : null), [input]);
  // The hint card's complete coordinate (no '?'): one preview pin to check it against the map before Registreren
  const preview = useMemo(() => (input?.source === 'card' ? previewPoint(input.x, input.y) : null), [input]);
  const fix = useMemo(() => (input?.area && input.at !== null ? lastFoxFix(markers ?? [], input.area, input.at) : null), [input, markers]);
  const rank = useMemo(() => (guess ? rankGuess(guess, fix, input?.at ?? null) : null), [guess, fix, input]);
  const shapes = useMemo(() => guessShapes(guess, rank), [guess, rank]);
  const area = useFadingShape(shapes.features.find((feature) => feature.properties.role === 'area') ?? null);
  const reach = useFadingShape(shapes.features.find((feature) => feature.properties.role === 'reach') ?? null);
  const data = useMemo<FeatureCollection<Polygon, GuessShapeProps>>(
    () => ({ type: 'FeatureCollection', features: [area.data, reach.data].filter((feature) => feature !== null) }),
    [area.data, reach.data],
  );

  // Focus taken out of the lowered phone sheet, given back after the pick (below)
  const sheetFocus = useRef<SheetFocus | null>(null);

  // Fly to the candidates when the guess itself changes (from Intel: once the window has closed)
  const fitKey = input ? `${input.source}|${input.x}|${input.y}|${input.area}` : '';
  useEffect(() => {
    if (!map || !guess || !input) return;
    const bounds = guessBounds(guess, fix);
    if (!bounds) return;
    // Phones: the sheet covers the map, lower it so the candidates can be tapped. The map's own padding then eases to
    // the peek height (~300 ms, an ease that would cancel our fit) and fitBounds adds its padding on top of it.
    let focusFrame = 0;
    if (isMobile) {
      // The lowered sheet's body goes inert: focus in it (a digit box) would drop to the page. Hand it to the best
      // candidate dot (or the map), and remember where it came from for after the pick
      const active = document.activeElement;
      const { sheetSnap, setSheetSnap } = useSidebarStore.getState();
      if (active instanceof HTMLElement && active.closest('[data-sheet-body]')) {
        sheetFocus.current = { snap: sheetSnap, element: active };
        focusFrame = requestAnimationFrame(() => {
          const dot = document.querySelector<HTMLElement>('[data-guess-dot="best"]') ?? document.querySelector<HTMLElement>('[data-guess-dot]');
          (dot ?? map.getCanvas()).focus({ preventScroll: true });
        });
      }
      setSheetSnap('peek');
    }
    // From Intel: after the window has closed; phones: after the sheet's padding ease, whichever is later
    const intel = input.source === 'intel';
    const delay = isMobile ? Math.max(SHEET_EASE_MS, intel ? INTEL_CLOSE_MS : 0) : intel ? INTEL_CLOSE_MS : 0;
    const timer = setTimeout(() => {
      // Desktop: the sidebar floats over the map's left edge, keep the candidates out from under it
      const padding = isMobile
        ? { top: 64, right: 32, bottom: 32, left: 32 }
        : { top: 80, right: 80, bottom: 80, left: 80 + (document.querySelector('aside')?.getBoundingClientRect().right ?? 0) };
      map.fitBounds(bounds, { padding, maxZoom: 15, duration: 1200 });
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(focusFrame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only when the guess changes, not on every marker poll
  }, [map, fitKey]);

  // Laptop: a preview pin outside the visible map is brought into view (same zoom); phones keep the map where it is, the
  // sheet would cover the pin anyway while typing
  const previewKey = preview ? `${preview.lng}|${preview.lat}` : '';
  useEffect(() => {
    if (!map || !preview || isMobile) return;
    if (map.getBounds().contains([preview.lng, preview.lat])) return;
    map.easeTo({ center: [preview.lng, preview.lat], duration: 800 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per typed coordinate, not on every marker poll
  }, [map, previewKey]);

  // The guess is gone (a dot picked, Escape, the card cleared it) while the focus handed to the map is still there or
  // lost: raise the sheet back to where it was and, once it is no longer inert, focus the hint form again
  useEffect(() => {
    if (input || !sheetFocus.current) return;
    const saved = sheetFocus.current;
    sheetFocus.current = null;
    if (!isMobile || !focusIsOnMapOrLost(map?.getCanvas())) return;
    useSidebarStore.getState().setSheetSnap(saved.snap === 'peek' ? 'half' : saved.snap);
    // After the sheet's rise; the picked digits are in the boxes by then, so Registreren knows whether it can send
    const timer = setTimeout(() => focusHintForm(saved), SHEET_EASE_MS);
    return () => clearTimeout(timer);
  }, [input, isMobile, map]);

  // Escape takes the guess off the map, but only when nothing else used that key press: Radix dialogs/popovers close on
  // Escape in the document capture phase and preventDefault it, so this bubble-phase window listener runs after them
  useEffect(() => {
    if (!input) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      if (target?.closest('[role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]')) return;
      clear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [input, clear]);

  const purple = dark ? '#b9a6ff' : '#7b61d1';
  const red = dark ? '#ffb4ab' : '#ba1a1a';
  const points = guess?.kind === 'points' ? guess.points : [];
  // Re-render when zoom, pitch or bearing changes the dots' screen spacing (a pan doesn't); same key, no re-render
  const [, setView] = useState('');
  const spaced = points.length > 1;
  useEffect(() => {
    if (!map || !spaced) return;
    const onView = () => setView(`${Math.round(map.getZoom() * 8)}|${Math.round(map.getPitch())}|${Math.round(map.getBearing())}`);
    map.on('zoom', onView);
    map.on('pitch', onView);
    map.on('rotate', onView);
    return () => {
      map.off('zoom', onView);
      map.off('pitch', onView);
      map.off('rotate', onView);
    };
  }, [map, spaced]);
  const hitSizes = map && spaced ? spacedHitDiameters(points.map((point) => map.project([point.lng, point.lat])), COARSE_HIT_PX) : null;

  return (
    <>
      <Source id={HINT_GUESS_SOURCE} type="geojson" data={data}>
        <Layer id={HINT_GUESS_REACH_LAYER} type="line" filter={REACH_FILTER}
               paint={{ 'line-color': red, 'line-width': zoomScaled(2), 'line-dasharray': [2, 2], 'line-opacity': reach.visible ? 1 : 0, 'line-opacity-transition': SHAPE_FADE }} />
        <Layer id={HINT_GUESS_AREA_FILL_LAYER} type="fill" filter={AREA_FILTER}
               paint={{ 'fill-color': purple, 'fill-opacity': area.visible ? 0.15 : 0, 'fill-opacity-transition': SHAPE_FADE }} />
        <Layer id={HINT_GUESS_AREA_LINE_LAYER} type="line" filter={AREA_FILTER}
               paint={{ 'line-color': purple, 'line-width': zoomScaled(2), 'line-dasharray': [3, 2], 'line-opacity': area.visible ? 1 : 0, 'line-opacity-transition': SHAPE_FADE }} />
      </Source>
      <AnimatePresence>
        {preview && (
          <Marker key={previewKey} longitude={preview.lng} latitude={preview.lat} anchor="center">
            {/* Not a button: nothing to pick, only to look at. Coloured like the filled digit boxes */}
            <motion.span
              role="img"
              aria-label="Getypte hint (nog niet geregistreerd)"
              title="Getypte hint (nog niet geregistreerd)"
              {...POP}
              className="pointer-events-none grid size-6 place-items-center rounded-full bg-primary-container text-on-primary-container shadow-md ring-2 ring-card"
            >
              <LightbulbIcon aria-hidden className="size-3.5" />
            </motion.span>
          </Marker>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {points.map((point, index) => {
          const role = rank?.roles[index] ?? 'in';
          // In the dot's own (scaled) px, so the hit area on screen is the spaced size
          const hit = Math.max(DOT_PX, (hitSizes?.[index] ?? COARSE_HIT_PX) / ROLE_SCALE[role]);
          return (
            <Marker key={point.digit} longitude={point.lng} latitude={point.lat} anchor="center"
                    onClick={(event) => {
                      event.originalEvent.stopPropagation();
                      pick(point.digit);
                    }}>
              <motion.button
                type="button"
                aria-label={guess?.kind === 'points' && guess.collapsed ? 'Gebruik deze plek' : `Gebruik cijfer ${point.digit}`}
                data-guess-dot={role}
                initial={{ opacity: 0, scale: 0.5 }}
                // The stagger is for entering only; dots leave together
                // The best candidate is drawn 1.25×, one out of the fox's reach 0.9× (scale, so the swaps animate); the
                // digit keeps full contrast, only the ring and shadow step back
                animate={{ opacity: 1, scale: role === 'best' ? 1.25 : role === 'out' ? 0.9 : 1, transition: { duration: 0.2, delay: index * 0.02 } }}
                exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                // before: an invisible round tap target around the 22 px dot, 32 px (mouse) or 44 px (touch), smaller where
                // dots crowd together so a tap always goes to the nearest dot
                style={{ '--hit': `${hit}px` } as CSSProperties}
                className={cn(
                  "relative flex size-[22px] cursor-pointer items-center justify-center rounded-full text-label font-bold tabular-nums shadow-md outline-none transition-[background-color,color,box-shadow] duration-200 before:absolute before:top-1/2 before:left-1/2 before:size-[min(32px,var(--hit))] before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:content-[''] pointer-coarse:before:size-(--hit) focus-visible:ring-[3px] focus-visible:ring-ring",
                  role === 'best'
                    ? 'bg-guess text-card ring-4 ring-guess/30'
                    : role === 'out'
                      ? 'bg-card text-on-guess-container shadow-sm ring-1 ring-guess/45'
                      : 'bg-card text-on-guess-container ring-2 ring-guess',
                )}
              >
                {guess?.kind === 'points' && guess.collapsed ? <CheckIcon aria-hidden className="size-3.5" /> : point.digit}
              </motion.button>
            </Marker>
          );
        })}
      </AnimatePresence>
    </>
  );
}
