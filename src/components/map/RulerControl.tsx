// Ruler.tsx
import {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {AnimatePresence} from 'motion/react';
import {useControl, useMap} from 'react-map-gl/maplibre';
import {withMaplibreClasses} from '@/lib/map-controls';
import type {ControlPosition} from 'react-map-gl/maplibre';
import RulerControl from '@mapbox-controls/ruler';
import '@mapbox-controls/ruler/src/index.css';
import type {CircleLayerSpecification, LineLayerSpecification, SymbolLayerSpecification} from "@maplibre/maplibre-gl-style-spec";
import type {Map as MaplibreMap} from 'maplibre-gl';
import CenterCrosshair from './CenterCrosshair';
import {nudgeDelta} from '@/lib/night-draw-keys';
import {RULER_OFF_MESSAGE, RULER_ON_MESSAGE, rulerDroppedMessage, rulerTotalMetres, rulerUndoMessage} from '@/lib/ruler-keys';
import {activatedByKeyboard} from '@/lib/input-modality';
import {formatDistance} from '@/lib/tracker';

/** A nudged point this close to the map's edge pans the map along (like NightAreaDraw) */
const NUDGE_EDGE_PX = 40;

type RulerProps = {
    position?: ControlPosition;              // e.g. 'bottom-right'
    onActivate?: () => void;                 // 'ruler.on'
    onDeactivate?: () => void;               // 'ruler.off'
    linePaint?: LineLayerSpecification['paint'];
    markerPaint?: CircleLayerSpecification['paint'];
    labelLayout?: SymbolLayerSpecification['layout'];
    labelPaint?: SymbolLayerSpecification['paint'];
    /** Keep the ruler off (e.g. while drawing a night area): switches it off now and whenever it is switched on */
    disabled?: boolean;
};

// @mapbox-controls/ruler emits custom, non-standard event names ('ruler.on',
// 'ruler.off') that aren't part of MapLibre's typed MapEventType.
type CustomEventMap = {
    on(type: string, listener: () => void): unknown;
    off(type: string, listener: () => void): unknown;
};

/** Ruler labels in Dutch notation like the rest of the app ("350 m", "1,3 km"); the package measures in kilometres */
const dutchKilometres = (km: number) => formatDistance(km * 1000);

export default function Ruler({position = 'bottom-right', onActivate, onDeactivate, disabled = false, ...options}: RulerProps) {
    // Add the control
    // The package is typed against mapbox-gl's style spec; the MapLibre one is the same for these layers
    const control = useControl(() => withMaplibreClasses(labelled(new RulerControl({labelFormat: dutchKilometres, ...options} as ConstructorParameters<typeof RulerControl>[0]))), {position});

    // Wire map events
    const {current: mapRef} = useMap();
    useEffect(() => {
        const map = mapRef?.getMap() as unknown as CustomEventMap | undefined;
        if (!map) return;

        if (onActivate) map.on('ruler.on', onActivate);
        if (onDeactivate) map.on('ruler.off', onDeactivate);

        return () => {
            if (onActivate) map.off('ruler.on', onActivate);
            if (onDeactivate) map.off('ruler.off', onDeactivate);
        };
    }, [mapRef, onActivate, onDeactivate]);

    // A toggle: aria-pressed follows the ruler (also when it's switched off by `disabled` or Escape)
    useEffect(() => {
        const map = mapRef?.getMap() as unknown as CustomEventMap | undefined;
        const button = control.button;
        if (!map || !button) return;
        const sync = () => button.setAttribute('aria-pressed', String(control.isActive));
        sync();
        map.on('ruler.on', sync);
        map.on('ruler.off', sync);
        return () => {
            map.off('ruler.on', sync);
            map.off('ruler.off', sync);
        };
    }, [mapRef, control]);

    useEffect(() => {
        const map = mapRef?.getMap() as unknown as CustomEventMap | undefined;
        if (!disabled || !map) return;
        const off = () => {
            if (control.isActive) control.deactivate();
        };
        off();
        // After activate() has finished (it fires 'ruler.on' halfway through)
        let timer: ReturnType<typeof setTimeout> | undefined;
        const onOn = () => {
            timer = setTimeout(off, 0);
        };
        map.on('ruler.on', onOn);
        return () => {
            map.off('ruler.on', onOn);
            clearTimeout(timer);
        };
    }, [mapRef, control, disabled]);

    // Keyboard measuring (lib/ruler-keys.ts), with the map focused: Enter drops a point at the centre crosshair, arrows
    // nudge the last point, Backspace takes it away, Escape switches the ruler off. Captured on the canvas container,
    // before MapLibre's own arrow-key panning. The ruler is desktop-only (Map.tsx), so is this.
    const [active, setActive] = useState(false);
    const [keyboardFocus, setKeyboardFocus] = useState(false);
    // What the live region last said; `n` makes the same sentence twice still a change, so it is read out again
    const [said, setSaid] = useState({text: '', n: 0});
    useEffect(() => {
        const map = mapRef?.getMap() as MaplibreMap | undefined;
        if (!map) return;
        const events = map as unknown as CustomEventMap;
        const container = map.getCanvasContainer();
        const canvas = map.getCanvas();
        const say = (text: string) => setSaid((prev) => ({text, n: prev.n + 1}));
        const handled = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();
        };
        const onOn = () => {
            setActive(true);
            say(RULER_ON_MESSAGE);
            // Switched on from the keyboard: the map takes focus, so Enter drops points right away
            if (activatedByKeyboard()) {
                canvas.focus();
                setKeyboardFocus(true);
            }
        };
        const onOff = () => {
            setActive(false);
            say(RULER_OFF_MESSAGE);
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (!control.isActive || e.altKey || e.ctrlKey || e.metaKey) return;
            const points = control.coordinates;
            if (e.key === 'Enter') {
                handled(e);
                const center = map.getCenter();
                control.addCoordinate([center.lng, center.lat]);
                say(rulerDroppedMessage(points.length, rulerTotalMetres(points)));
                return;
            }
            if (e.key === 'Backspace') {
                if (!points.length) return;
                handled(e);
                points.pop();
                control.updateSource();
                say(rulerUndoMessage(points.length, rulerTotalMetres(points)));
                return;
            }
            if (e.key === 'Escape') {
                handled(e);
                control.deactivate();
                return;
            }
            const delta = nudgeDelta(e.key, e.shiftKey);
            const last = points.at(-1);
            // No point yet: the arrows pan the map as usual, to pick the spot for the first one
            if (!delta || !last) return;
            handled(e);
            const at = map.project(last);
            const x = at.x + delta[0];
            const y = at.y + delta[1];
            const next = map.unproject([x, y]);
            points[points.length - 1] = [next.lng, next.lat];
            control.updateSource();
            // Near the edge the map pans along, so the point stays in view
            const {clientWidth: width, clientHeight: height} = canvas;
            if (x < NUDGE_EDGE_PX || y < NUDGE_EDGE_PX || x > width - NUDGE_EDGE_PX || y > height - NUDGE_EDGE_PX) map.panBy(delta, {duration: 150});
        };
        // The crosshair shows only while the map has keyboard focus (a mouse click on the map focuses it too)
        const onFocus = () => setKeyboardFocus(canvas.matches(':focus-visible'));
        const onBlur = () => setKeyboardFocus(false);
        events.on('ruler.on', onOn);
        events.on('ruler.off', onOff);
        container.addEventListener('keydown', onKeyDown, {capture: true});
        canvas.addEventListener('focus', onFocus);
        canvas.addEventListener('blur', onBlur);
        return () => {
            events.off('ruler.on', onOn);
            events.off('ruler.off', onOff);
            container.removeEventListener('keydown', onKeyDown, {capture: true});
            canvas.removeEventListener('focus', onFocus);
            canvas.removeEventListener('blur', onBlur);
        };
    }, [mapRef, control]);

    const map = mapRef?.getMap() as MaplibreMap | undefined;
    if (!map) return null;
    const color = typeof options.linePaint?.['line-color'] === 'string' ? options.linePaint['line-color'] : '#1473e8';
    return createPortal(
        <>
            <AnimatePresence>{active && keyboardFocus && <CenterCrosshair key="crosshair" map={map} color={color}/>}</AnimatePresence>
            {/* Always mounted, so each keyboard step is read out (a freshly mounted region often isn't) */}
            <div role="status" aria-live="polite" className="sr-only">
                {said.text}
                {said.n % 2 ? '\u00a0' : ''}
            </div>
        </>,
        map.getContainer(),
    );
}

/** Dutch name for the package's button (it says "Ruler"), and a toggle state from the start. */
function labelled(control: RulerControl): RulerControl {
    control.button?.setAttribute('aria-label', 'Afstand meten');
    control.button?.setAttribute('title', 'Afstand meten');
    control.button?.setAttribute('aria-pressed', 'false');
    return control;
}
