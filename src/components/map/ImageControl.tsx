import {useEffect} from 'react';
import {useControl, useMap} from 'react-map-gl/maplibre';
import {withMaplibreClasses} from '@/lib/map-controls';
import type {ControlPosition} from 'react-map-gl/maplibre';
import type {MapLibreEvent} from 'maplibre-gl';
import MapboxImageControl from '@mapbox-controls/image';
import '@mapbox-controls/image/src/index.css';

type ImageControlOptions = ConstructorParameters<typeof MapboxImageControl>[0];
type ImageControlEvent = MapLibreEvent & Record<string, unknown>;

// @mapbox-controls/image emits custom, non-standard event names
// ('image.select', ...) that aren't part of MapLibre's typed MapEventType.
// Narrow to the subset of the Map API we need and accept arbitrary event
// names for it.
type CustomEventMap = {
    on(type: string, listener: (event: ImageControlEvent) => void): unknown;
    off(type: string, listener: (event: ImageControlEvent) => void): unknown;
};

type ImageControlProps = ImageControlOptions & {
    position?: ControlPosition;
    onSelect?: (event: ImageControlEvent) => void;
    onDeselect?: (event: ImageControlEvent) => void;
    onMode?: (event: ImageControlEvent) => void;
    onUpdate?: (event: ImageControlEvent) => void;
    onAdd?: (event: ImageControlEvent) => void;
    onRemove?: (event: ImageControlEvent) => void;
};

export default function ImageControl({
    position = 'top-right',
    onSelect,
    onDeselect,
    onMode,
    onUpdate,
    onAdd,
    onRemove,
    ...options
}: ImageControlProps) {
    useControl(() => withMaplibreClasses(new MapboxImageControl(options)), {position});

    const {current: mapRef} = useMap();
    useEffect(() => {
        const map = mapRef?.getMap() as unknown as CustomEventMap | undefined;
        if (!map) return;

        if (onSelect) map.on('image.select', onSelect);
        if (onDeselect) map.on('image.deselect', onDeselect);
        if (onMode) map.on('image.mode', onMode);
        if (onUpdate) map.on('image.update', onUpdate);
        if (onAdd) map.on('image.add', onAdd);
        if (onRemove) map.on('image.remove', onRemove);

        return () => {
            if (onSelect) map.off('image.select', onSelect);
            if (onDeselect) map.off('image.deselect', onDeselect);
            if (onMode) map.off('image.mode', onMode);
            if (onUpdate) map.off('image.update', onUpdate);
            if (onAdd) map.off('image.add', onAdd);
            if (onRemove) map.off('image.remove', onRemove);
        };
    }, [mapRef, onSelect, onDeselect, onMode, onUpdate, onAdd, onRemove]);

    return null;
}
