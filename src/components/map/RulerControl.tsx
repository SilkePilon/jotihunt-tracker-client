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
};

// @mapbox-controls/ruler emits custom, non-standard event names ('ruler.on',
// 'ruler.off') that aren't part of MapLibre's typed MapEventType.
type CustomEventMap = {
    on(type: string, listener: () => void): unknown;
    off(type: string, listener: () => void): unknown;
};

export default function Ruler({position = 'bottom-right', onActivate, onDeactivate, ...options}: RulerProps) {
    // Add the control
    // The package is typed against mapbox-gl's style spec; the MapLibre one is the same for these layers
    useControl(() => withMaplibreClasses(new RulerControl(options as ConstructorParameters<typeof RulerControl>[0])), {position});

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

    return null;
}