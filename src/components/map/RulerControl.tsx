// Ruler.tsx
import {useEffect} from 'react';
import {useControl, useMap} from 'react-map-gl/maplibre';
import {withMaplibreClasses} from '@/lib/map-controls';
import type {ControlPosition} from 'react-map-gl/maplibre';
import RulerControl from '@mapbox-controls/ruler';
import '@mapbox-controls/ruler/src/index.css';
import type {CircleLayerSpecification, LineLayerSpecification, SymbolLayerSpecification} from "@maplibre/maplibre-gl-style-spec";

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

export default function Ruler({position = 'bottom-right', onActivate, onDeactivate, disabled = false, ...options}: RulerProps) {
    // Add the control
    // The package is typed against mapbox-gl's style spec; the MapLibre one is the same for these layers
    const control = useControl(() => withMaplibreClasses(labelled(new RulerControl(options as ConstructorParameters<typeof RulerControl>[0]))), {position});

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

    return null;
}

/** Dutch name for the package's button (it says "Ruler"), and a toggle state from the start. */
function labelled(control: RulerControl): RulerControl {
    control.button?.setAttribute('aria-label', 'Afstand meten');
    control.button?.setAttribute('title', 'Afstand meten');
    control.button?.setAttribute('aria-pressed', 'false');
    return control;
}
