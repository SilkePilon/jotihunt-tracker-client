import Maplibre, {
    AttributionControl,
    GeolocateControl,
    NavigationControl,
    ScaleControl,
    MapRef as MaplibreRef,
    type MapLayerMouseEvent,
} from 'react-map-gl/maplibre';

import 'maplibre-gl/dist/maplibre-gl.css';
import {setWorkerUrl} from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

import type {LngLat, Map as MaplibreMap, StyleSpecification} from 'maplibre-gl';
import Teams from './layers/Teams';
import Devices from './layers/Devices';
import Markers from './layers/Markers';
import {forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {useShallow} from 'zustand/react/shallow';
import HomeCircle from './layers/HomeCircle';
import Predictions from './layers/Predictions';
import {usePredictionSetting} from '@/hooks/predictions.hook';
import useLayersStore from '../stores/layers.store';
import useSettingsStore from '../stores/settings.store';
import {MapStyle} from '@/types/MapStyle';
import {getHybridSatelliteStyle, resolveStaticMapStyle} from '@/lib/map-styles';
import {useDarkMode} from '@/hooks/utils/darkmode.hook';
import {useIsMobile} from '@/hooks/media.hook';
import PickedLocationPopup from './map/PickedLocationPopup';
import {FullscreenControl} from "react-map-gl/maplibre";
import '@mapbox-controls/ruler/src/index.css';
import Ruler from "@/components/map/RulerControl.tsx";
import type {SymbolLayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {DEFAULT_VIEW} from '@/lib/map-view';
import {FOX_MARKERS_LAYER} from '@/lib/map-layers';
import {tourTarget} from '@/components/tour/targets';

// MapLibre resolves its worker relative to its own module, which bundlers don't emit;
// let Vite bundle the worker and hand MapLibre the resulting URL. Here, not in main.tsx, so the
// map library stays out of the login page's chunk.
setWorkerUrl(maplibreWorkerUrl);

type FlyToOpts = NonNullable<Parameters<MaplibreMap["flyTo"]>[0]>;

export interface MapRef {
    flyTo(options: FlyToOpts): void;

    markPoint(lngLat: LngLat): void;
}

// react-map-gl/maplibre's maxBounds prop expects a flat [west, south, east, north] tuple.
const maxBounds: [number, number, number, number] = [
    3.314971144228537, 50.80372101501058,
    7.092053256784122, 53.51040334737814,
];

// Ruler in the app's blue; the distances are white on a thick blue halo so they read on light, dark and satellite maps
const RULER_COLOR = '#1473e8';
const RULER_LINE_PAINT = {'line-color': RULER_COLOR, 'line-width': 3};
const RULER_MARKER_PAINT = {'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-width': 2.5, 'circle-stroke-color': RULER_COLOR};
const RULER_LABEL_LAYOUT: SymbolLayerSpecification['layout'] = {
    'text-field': '{distance}',
    'text-size': 14,
    'text-offset': [0, 1],
    'text-anchor': 'top',
    'text-allow-overlap': true,
    'text-ignore-placement': true,
};
const RULER_LABEL_PAINT = {'text-color': '#fff', 'text-halo-color': RULER_COLOR, 'text-halo-width': 3.5};

// Clicks on these canvas layers open their own popup instead of the location popup
const INTERACTIVE_LAYER_IDS = [FOX_MARKERS_LAYER];

const Map = forwardRef<MapRef, { className?: string }>(({className}, ref) => {

    const GROUP_NAME: string = import.meta.env.GROUP_NAME;

    // Make map fly available to other components
    const mapRef = useRef<MaplibreRef>(null);
    useImperativeHandle(ref, () => ({
        flyTo: (options: FlyToOpts) => {
            if (mapRef.current) {
                mapRef.current.flyTo(options);
            }
        },
        markPoint: (lngLat: LngLat) => {
            if (mapRef.current) {
                setPopupPosition(lngLat);
            }
        }
    }));

    // Store for all layers
    const {showTeams, showDevices, showMarkersPart1, showMarkersPart2, showHomeCircle, showPredictions} = useLayersStore(
        useShallow((state) => ({
            showTeams: state.showTeams,
            showDevices: state.showDevices,
            showMarkersPart1: state.showMarkersPart1,
            showMarkersPart2: state.showMarkersPart2,
            showHomeCircle: state.showHomeCircle,
            showPredictions: state.showPredictions,
        })),
    );
    const {enabled: predictionEnabled} = usePredictionSetting();
    const [popupPosition, setPopupPosition] = useState<LngLat>();
    const [rulerActive, setRulerActive] = useState<boolean>(false);
    // Stable, so the ruler doesn't re-subscribe its map events on every render
    const activateRuler = useCallback(() => setRulerActive(true), []);
    const deactivateRuler = useCallback(() => setRulerActive(false), []);

    // Store for settings
    const mapStyle = useSettingsStore((state) => state.mapStyle);
    const isDarkMode = useDarkMode();
    const isMobile = useIsMobile();
    let correctedMapStyle = mapStyle;
    if (!correctedMapStyle) {
        correctedMapStyle = isDarkMode ? MapStyle.Dark : MapStyle.Streets;
    }

    // Resolve the style id to a style URL/object. The satellite style starts
    // out raster-only, then upgrades to the hybrid (labels on top) style
    // once the OpenFreeMap liberty style JSON has been fetched.
    const [resolvedMapStyle, setResolvedMapStyle] = useState<string | StyleSpecification>(() =>
        resolveStaticMapStyle(correctedMapStyle),
    );

    useEffect(() => {
        let cancelled = false;
        setResolvedMapStyle(resolveStaticMapStyle(correctedMapStyle));

        if (correctedMapStyle === MapStyle.Satellite) {
            getHybridSatelliteStyle().then((style) => {
                if (!cancelled) setResolvedMapStyle(style);
            });
        }

        return () => {
            cancelled = true;
        };
    }, [correctedMapStyle]);

    /**
     * Open the current location popup when the map is clicked.
     */
    function openPopup(e: MapLayerMouseEvent) {
        if (popupPosition || rulerActive || e.features?.length) return;

        setPopupPosition(e.lngLat);
    }

    return (
        <div className={className ?? "w-dvw h-dvh"} {...tourTarget('map')}>
            <Maplibre
                ref={mapRef}
                reuseMaps
                initialViewState={DEFAULT_VIEW}
                style={{width: '100%', height: '100%'}}
                attributionControl={false}
                mapStyle={resolvedMapStyle}
                maxBounds={maxBounds}
                onClick={openPopup}
                interactiveLayerIds={INTERACTIVE_LAYER_IDS}
                // Phones: start with the credits collapsed to the (i) button; MapLibre opens them on load
                onLoad={(event) => {
                    if (isMobile) event.target.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
                }}
            >
                <div className="bg-background">
                    {/* Credits on the right: bottom-right on desktop; on phones top-right, above the bottom sheet. */}
                    <AttributionControl position={isMobile ? 'top-right' : 'bottom-right'} customAttribution={GROUP_NAME ? `Jotihunt Tracker | ${GROUP_NAME}` : 'Jotihunt Tracker'} compact={true}/>
                </div>
                {/* Phones: no map controls, the map is navigated by touch and the bottom sheet needs the room */}
                {!isMobile && (
                    <>
                        <ScaleControl/>
                        {/* Bottom corners stack upwards (the last added control ends up on top), so add bottom-to-top:
                            credits (above), ruler, fullscreen, my location, zoom */}
                        <Ruler linePaint={RULER_LINE_PAINT} markerPaint={RULER_MARKER_PAINT}
                               labelLayout={RULER_LABEL_LAYOUT} labelPaint={RULER_LABEL_PAINT}
                               position="bottom-right" onActivate={activateRuler}
                               onDeactivate={deactivateRuler}/>
                        <FullscreenControl position="bottom-right"/>
                        <GeolocateControl position="bottom-right"/>
                        <NavigationControl position="bottom-right" showCompass={false}/>
                    </>
                )}
                {popupPosition && <PickedLocationPopup lng={popupPosition.lng} lat={popupPosition.lat}
                                                       onClose={() => setPopupPosition(undefined)}/>}
                {showPredictions && predictionEnabled !== false && <Predictions/>}
                {showTeams && <Teams/>}
                {showDevices && <Devices/>}
                {(showMarkersPart1 || showMarkersPart2) && <Markers part1={showMarkersPart1} part2={showMarkersPart2}/>}
                {showHomeCircle && <HomeCircle/>}
            </Maplibre>
        </div>
    );
});

export default Map;
