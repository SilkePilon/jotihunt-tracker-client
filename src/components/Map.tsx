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

import type {LngLat, Map as MaplibreMap, RequestTransformFunction, StyleSpecification} from 'maplibre-gl';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import Buildings3D from './layers/Buildings3D';
import {isBuildingsTileUrl} from '@/lib/buildings';
import Teams from './layers/Teams';
import Devices from './layers/Devices';
import Life360 from './layers/Life360';
import Markers from './layers/Markers';
import {forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode} from 'react';
import {useShallow} from 'zustand/react/shallow';
import HomeCircle from './layers/HomeCircle';
import Predictions from './layers/Predictions';
import {usePredictionSetting} from '@/hooks/predictions.hook';
import useLayersStore from '../stores/layers.store';
import useSettingsStore from '../stores/settings.store';
import {MapStyle} from '@/types/MapStyle';
import {getHybridSatelliteStyle, resolveStaticMapStyle} from '@/lib/map-styles';
import {materialMapStyle} from '@/lib/map-style';
import {useDarkMode} from '@/hooks/utils/darkmode.hook';
import {useIsMobile} from '@/hooks/media.hook';
import PickedLocationPopup from './map/PickedLocationPopup';
import {FullscreenControl} from "react-map-gl/maplibre";
import '@mapbox-controls/ruler/src/index.css';
import Ruler from "@/components/map/RulerControl.tsx";
import type {SymbolLayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {DEFAULT_VIEW} from '@/lib/map-view';
import {FOX_MARKERS_LAYER, HUNTER_ARROWS_LAYER, HUNTERS_LAYER, LIFE360_LAYER, TEAM_PINS_LAYER} from '@/lib/map-layers';
import LayerStack from './layers/LayerStack';
import MarkerImages from './layers/MarkerImages';
import {markerCssVars, useMarkerPalette} from './layers/marker-icons';
import {vehicleGlyph} from '@/lib/marker-style';
import {useTrackerStatus} from '@/hooks/tracker.hook';
import {tourTarget} from '@/components/tour/targets';

// MapLibre resolves its worker relative to its own module, which bundlers don't emit;
// let Vite bundle the worker and hand MapLibre the resulting URL. Here, not in main.tsx, so the
// map library stays out of the login page's chunk.
setWorkerUrl(maplibreWorkerUrl);

type FlyToOpts = NonNullable<Parameters<MaplibreMap["flyTo"]>[0]>;
type FitBoundsArgs = Parameters<MaplibreMap["fitBounds"]>;

export interface MapRef {
    flyTo(options: FlyToOpts): void;

    /** False while the map isn't created yet (react-map-gl fills its ref after the first render). */
    fitBounds(bounds: FitBoundsArgs[0], options?: FitBoundsArgs[1]): boolean;

    markPoint(lngLat: LngLat): void;

    /** The map's centre; null while the map isn't created yet. */
    getCenter(): LngLat | null;
}

interface MapProps {
    className?: string;
    /** HQ wall screen: no controls, no location popup, no user interaction */
    wall?: boolean;
    /** Rendered inside the map, e.g. react-map-gl Markers */
    overlay?: ReactNode;
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
const INTERACTIVE_LAYER_IDS = [FOX_MARKERS_LAYER, TEAM_PINS_LAYER, HUNTERS_LAYER, HUNTER_ARROWS_LAYER, LIFE360_LAYER];

const Map = forwardRef<MapRef, MapProps>(({className, wall = false, overlay}, ref) => {

    const GROUP_NAME: string = import.meta.env.GROUP_NAME;

    // Make map fly available to other components
    const mapRef = useRef<MaplibreRef>(null);
    useImperativeHandle(ref, () => ({
        flyTo: (options: FlyToOpts) => {
            if (mapRef.current) {
                mapRef.current.flyTo(options);
            }
        },
        fitBounds: (bounds, options) => {
            if (!mapRef.current) return false;
            mapRef.current.fitBounds(bounds, options);
            return true;
        },
        markPoint: (lngLat: LngLat) => {
            if (mapRef.current) {
                setPopupPosition(lngLat);
            }
        },
        getCenter: () => mapRef.current?.getCenter() ?? null,
    }));

    // Store for all layers
    const {showTeams, showDevices, showMarkersPart1, showMarkersPart2, showHomeCircle, showPredictions, showLife360, showBuildings3d} = useLayersStore(
        useShallow((state) => ({
            showTeams: state.showTeams,
            showDevices: state.showDevices,
            showMarkersPart1: state.showMarkersPart1,
            showMarkersPart2: state.showMarkersPart2,
            showHomeCircle: state.showHomeCircle,
            showPredictions: state.showPredictions,
            showLife360: state.showLife360,
            showBuildings3d: state.showBuildings3d,
        })),
    );
    const {enabled: predictionEnabled} = usePredictionSetting();
    // The building tiles come from our API, which needs the Authorization header; MapLibre takes transformRequest only
    // once, so it reads the latest header from a ref
    const authHeader = useAuthHeader() || '';
    const authHeaderRef = useRef(authHeader);
    useEffect(() => {
        authHeaderRef.current = authHeader;
    }, [authHeader]);
    const transformRequest = useCallback<RequestTransformFunction>(
        (url) => (isBuildingsTileUrl(url, import.meta.env.API_BASE_URL) ? {url, headers: {Authorization: authHeaderRef.current}} : {url}),
        [],
    );
    // react-map-gl only passes transformRequest when it creates the map; with reuseMaps a later <Map> (the HQ page, a
    // re-login) gets the first mount's MapLibre instance, so make this component's callback the active one
    useEffect(() => {
        mapRef.current?.getMap().setTransformRequest(transformRequest);
    }, [transformRequest]);
    const [popupPosition, setPopupPosition] = useState<LngLat>();
    const [rulerActive, setRulerActive] = useState<boolean>(false);
    // Stable, so the ruler doesn't re-subscribe its map events on every render
    const activateRuler = useCallback(() => setRulerActive(true), []);
    const deactivateRuler = useCallback(() => setRulerActive(false), []);

    // Store for settings
    const mapStyle = useSettingsStore((state) => state.mapStyle);
    const isDarkMode = useDarkMode();
    const isMobile = useIsMobile();
    // Own position like the Android app's: the vehicle of our own tracker (a person without one)
    const {status: tracker} = useTrackerStatus();
    const markerPalette = useMarkerPalette();
    const meVehicle = tracker?.configured ? tracker.vehicle : undefined;
    const markerVars = useMemo(() => markerCssVars(markerPalette, vehicleGlyph(meVehicle ?? 'phone')), [markerPalette, meVehicle]);
    // Wall: MapLibre still fires click/mousemove with interactive={false}, which would open the layers' popups and
    // hover tooltips; no pointer events at all keeps the wall display-only
    const wrapperStyle = useMemo(() => (wall ? {...markerVars, pointerEvents: 'none' as const} : markerVars), [markerVars, wall]);
    // Resolve the style to a style URL/object. '' (automatic, the default) is the Material map, light or dark with the
    // site's theme. The Material style is built synchronously from the bundled Liberty copy;
    // a theme switch only changes paint colours, so react-map-gl's style diff keeps the overlay sources and markers.
    // The satellite style starts out raster-only, then upgrades to the hybrid (labels on top) style once the
    // OpenFreeMap liberty style JSON has been fetched.
    const staticStyle = useMemo(
        () => (mapStyle ? resolveStaticMapStyle(mapStyle) : materialMapStyle(isDarkMode)),
        [mapStyle, isDarkMode],
    );
    const [hybridSatellite, setHybridSatellite] = useState<StyleSpecification>();
    const resolvedMapStyle = mapStyle === MapStyle.Satellite && hybridSatellite ? hybridSatellite : staticStyle;

    useEffect(() => {
        if (mapStyle !== MapStyle.Satellite) return;
        let cancelled = false;
        getHybridSatelliteStyle().then((style) => {
            if (!cancelled) setHybridSatellite(style);
        });
        return () => {
            cancelled = true;
        };
    }, [mapStyle]);

    /**
     * Open the current location popup when the map is clicked.
     */
    function openPopup(e: MapLayerMouseEvent) {
        if (popupPosition || rulerActive || e.features?.length) return;

        setPopupPosition(e.lngLat);
    }

    return (
        <div className={className ?? "w-dvw h-dvh"} style={wrapperStyle} {...tourTarget('map')}>
            <Maplibre
                ref={mapRef}
                reuseMaps
                initialViewState={DEFAULT_VIEW}
                style={{width: '100%', height: '100%'}}
                attributionControl={false}
                mapStyle={resolvedMapStyle}
                transformRequest={transformRequest}
                maxBounds={maxBounds}
                interactive={!wall}
                onClick={wall ? undefined : openPopup}
                interactiveLayerIds={INTERACTIVE_LAYER_IDS}
                // No symbol fade: every tracker poll moves the hunter icons, which then faded in again (about 20 extra
                // full map repaints per poll); the HTML markers they replace moved instantly
                fadeDuration={0}
                // Phones and the HQ wall: start with the credits collapsed to the (i) button; MapLibre opens them on load
                onLoad={(event) => {
                    event.target.setTransformRequest(transformRequest);
                    if (isMobile || wall) event.target.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
                }}
            >
                <div className="bg-background">
                    {/* Credits on the right: bottom-right on desktop; on phones top-right, above the bottom sheet; on the HQ wall top-right, above the event card. */}
                    <AttributionControl position={isMobile || wall ? 'top-right' : 'bottom-right'} customAttribution={GROUP_NAME ? `Jotihunt Tracker | ${GROUP_NAME}` : 'Jotihunt Tracker'} compact={true}/>
                </div>
                {/* Phones: no map controls, the map is navigated by touch and the bottom sheet needs the room */}
                {!isMobile && !wall && (
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
                {/* Before the layers, so it listens for their images from the start */}
                <MarkerImages/>
                {popupPosition && !wall && <PickedLocationPopup lng={popupPosition.lng} lat={popupPosition.lat}
                                                       onClose={() => setPopupPosition(undefined)}/>}
                <Buildings3D visible={showBuildings3d}/>
                {showPredictions && predictionEnabled !== false && <Predictions/>}
                {showTeams && <Teams/>}
                {showDevices && <Devices/>}
                {showLife360 && <Life360/>}
                {(showMarkersPart1 || showMarkersPart2) && <Markers part1={showMarkersPart1} part2={showMarkersPart2}/>}
                <HomeCircle showCircle={showHomeCircle}/>
                <LayerStack/>
                {overlay}
            </Maplibre>
        </div>
    );
});

export default Map;
