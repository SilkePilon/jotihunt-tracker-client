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
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import Buildings3D from './layers/Buildings3D';
import {setBuildingsAuthHeader} from '@/lib/buildings-protocol';
import Teams from './layers/Teams';
import FastFood from './layers/FastFood';
import Devices from './layers/Devices';
import Life360 from './layers/Life360';
import Markers from './layers/Markers';
import {forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {useShallow} from 'zustand/react/shallow';
import HomeCircle from './layers/HomeCircle';
import HuntFocus from './layers/HuntFocus';
import HuntAccuracy from './layers/HuntAccuracy';
import HintGuess from './layers/HintGuess';
import Predictions from './layers/Predictions';
import Reach from './layers/Reach';
import {usePredictionSetting} from '@/hooks/predictions.hook';
import useLayersStore from '../stores/layers.store';
import useSettingsStore from '../stores/settings.store';
import useSidebarStore from '@/stores/sidebar.store';
import {MapStyle} from '@/types/MapStyle';
import {getHybridSatelliteStyle, resolveStaticMapStyle} from '@/lib/map-styles';
import {materialMapStyle} from '@/lib/map-style';
import {mapStyleKey} from '@/lib/map-availability';
import {useDarkMode} from '@/hooks/utils/darkmode.hook';
import {useIsMobile} from '@/hooks/media.hook';
import PickedLocationPopup from './map/PickedLocationPopup';
import OrbitControls from './map/OrbitControls';
import MapLayersControl from './map/MapLayersControl';
import {MapRotationTracker, ResetNorthControl} from './map/ResetNorth';
import {keepFocusAfterReset, resetNorth} from '@/lib/reset-north';
import {ORBIT_MAX_PITCH} from '@/lib/orbit';
import {FullscreenControl} from "react-map-gl/maplibre";
import '@mapbox-controls/ruler/src/index.css';
import Ruler from "@/components/map/RulerControl.tsx";
import {MAP_LOCALE_NL} from "@/lib/map-locale";
import type {SymbolLayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {DEFAULT_VIEW} from '@/lib/map-view';
import {FASTFOOD_LAYER, FOX_MARKERS_LAYER, HUNTER_ARROWS_LAYER, HUNTERS_LAYER, LIFE360_LAYER, TEAM_PINS_LAYER, TRAILS_HIT_LAYER} from '@/lib/map-layers';
import LayerStack from './layers/LayerStack';
import MarkerImages from './layers/MarkerImages';
import {markerCssVars, useMarkerPalette} from './layers/marker-icons';
import {vehicleGlyph} from '@/lib/marker-style';
import {useTrackerStatus} from '@/hooks/tracker.hook';
import {useAppConfig} from '@/hooks/app-config.hook';
import {tourTarget} from '@/components/tour/targets';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import {AnimatePresence} from 'motion/react';
import {cn} from '@/lib/utils';
import type {User} from '@/types/User';
import {useNightDraw} from '@/stores/night-draw.store';
import NightAreaDraw from './layers/trails/NightAreaDraw';
import NightAreasLayer from './layers/trails/NightAreasLayer';
import MapUnavailableCard from './map/MapUnavailableCard';
import {openLayerFeature, type OpenFeatureOptions} from './layers/map-interactions';
import {useMapAvailability} from './map/useMapAvailability';

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

    /**
     * Open the popup of a canvas marker layer's feature (by its `id` property), the same popup a click opens: for
     * lists that fly the map to a marker. False when the layer is hidden or has no such feature. `focus`: the popup
     * takes focus (pass it for keyboard activations, see activatedByKeyboard).
     */
    openFeature(layer: string, id: string | number, options?: OpenFeatureOptions): boolean;

    /** The map's centre; null while the map isn't created yet. */
    getCenter(): LngLat | null;

    /** The current zoom level; null while the map isn't created yet. */
    getZoom(): number | null;

    /**
     * Back to north-up and flat (the phone dock's reset tile). `from`: the pressed button; when it had keyboard focus the
     * map takes it, as the tile folds away.
     */
    resetNorth(from?: HTMLElement): void;
}

interface MapProps {
    className?: string;
    /** HQ wall screen: no controls, no location popup, no user interaction */
    wall?: boolean;
    /** Rendered inside the map, e.g. react-map-gl Markers */
    overlay?: ReactNode;
}

// react-map-gl/maplibre's maxBounds prop expects a flat [west, south, east, north] tuple.
// MapLibre keeps the whole viewport inside these bounds, including the part behind the sidebar, so they reach well past
// the Dutch border: the east edge of the country must still fit beside the sidebar when zoomed out.
const maxBounds: [number, number, number, number] = [
    2.3, 50.3,
    8.4, 54.0,
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
const INTERACTIVE_LAYER_IDS = [FOX_MARKERS_LAYER, TEAM_PINS_LAYER, HUNTERS_LAYER, HUNTER_ARROWS_LAYER, LIFE360_LAYER, FASTFOOD_LAYER, TRAILS_HIT_LAYER];

/** Bottom map padding for the phone sheet's current snap (undefined on desktop, the HQ wall, or before the sheet measured) */
function phonePaddingFor(wall: boolean): number | undefined {
    const {sheetSnapHeights, sheetSnap} = useSidebarStore.getState();
    return wall || !sheetSnapHeights ? undefined : sheetSnapHeights[sheetSnap];
}

// Memoized: Layout re-renders often and the map's props (ref, the HQ wall's memoized overlay) rarely change
const Map = memo(forwardRef<MapRef, MapProps>(({className, wall = false, overlay}, ref) => {

    const {groupName} = useAppConfig();
    // Admins draw their own night areas on the map (Beheer → Routes); never on the HQ wall
    const isAdmin = !!useAuthUser<User>()?.admin && !wall;
    const drawing = useNightDraw((state) => state.active) && isAdmin;

    // Make map fly available to other components
    const mapRef = useRef<MaplibreRef>(null);
    useImperativeHandle(ref, () => ({
        flyTo: (options: FlyToOpts) => {
            if (mapRef.current) {
                // Phones: fly with the padding of the snap the sheet is heading to (a caller lowering the sheet sets the
                // snap first), so the point lands above the sheet and the padding effect has nothing left to ease
                const bottom = phonePaddingFor(wall);
                mapRef.current.flyTo(bottom === undefined || options.padding !== undefined ? options : {...options, padding: {top: 0, left: 0, right: 0, bottom}});
            }
        },
        fitBounds: (bounds, options) => {
            if (!mapRef.current) return false;
            mapRef.current.fitBounds(bounds, options);
            return true;
        },
        markPoint: (lngLat: LngLat) => {
            // No location popup while a night area is being drawn
            if (mapRef.current && !drawing) {
                setPopupPosition(lngLat);
            }
        },
        openFeature: (layer: string, id: string | number, options?: OpenFeatureOptions) => {
            const map = mapRef.current?.getMap();
            return !!map && !wall && openLayerFeature(map, layer, id, options);
        },
        getCenter: () => mapRef.current?.getCenter() ?? null,
        getZoom: () => mapRef.current?.getZoom() ?? null,
        resetNorth: (from?: HTMLElement) => {
            const map = mapRef.current?.getMap();
            if (!map) return;
            if (from) keepFocusAfterReset(from, map);
            resetNorth(map);
        },
    }));

    // Store for all layers
    const {showTeams, showDevices, showMarkersPart1, showMarkersPart2, showHomeCircle, showPredictions, showReach, showLife360, showBuildings3d, showMcDonalds, showKfc, showBurgerKing} = useLayersStore(
        useShallow((state) => ({
            showTeams: state.showTeams,
            showDevices: state.showDevices,
            showMarkersPart1: state.showMarkersPart1,
            showMarkersPart2: state.showMarkersPart2,
            showHomeCircle: state.showHomeCircle,
            showPredictions: state.showPredictions,
            showReach: state.showReach,
            showLife360: state.showLife360,
            showBuildings3d: state.showBuildings3d,
            showMcDonalds: state.showMcDonalds,
            showKfc: state.showKfc,
            showBurgerKing: state.showBurgerKing,
        })),
    );
    const {enabled: predictionEnabled} = usePredictionSetting();
    // The building tiles come from our API, which needs the Authorization header (fetched by the jhbuildings protocol);
    // a layout effect, so it's set before the building source starts loading tiles
    const authHeader = useAuthHeader() || '';
    useLayoutEffect(() => {
        setBuildingsAuthHeader(authHeader);
    }, [authHeader]);
    const [popupPosition, setPopupPosition] = useState<LngLat>();
    const [rulerActive, setRulerActive] = useState<boolean>(false);
    // Stable, so the ruler doesn't re-subscribe its map events on every render
    const activateRuler = useCallback(() => setRulerActive(true), []);
    const deactivateRuler = useCallback(() => setRulerActive(false), []);
    // Drawing a night area takes over map clicks: close the location popup (the ruler is switched off below)
    useEffect(() => {
        if (drawing) setPopupPosition(undefined);
    }, [drawing]);

    // Store for settings
    const mapStyle = useSettingsStore((state) => state.mapStyle);
    const isDarkMode = useDarkMode();
    const isMobile = useIsMobile();
    // Phones: the bottom sheet covers the lower part of the map; padding keeps every flyTo/easeTo centre above it
    const sheetHeight = useSidebarStore((state) => state.sheetHeight);
    const bottomPadding = isMobile && !wall ? sheetHeight : 0;
    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (!map) return;
        const apply = () => {
            // Nothing to do (desktop/HQ on mount, or a flyTo that already carried this padding)
            if (map.getPadding().bottom === bottomPadding) return;
            map.easeTo({padding: {top: 0, left: 0, right: 0, bottom: bottomPadding}, duration: 300});
        };
        // easeTo stops a running camera move: a "show on map" that lowers the sheet would be cancelled. Pad once it lands.
        if (map.isMoving()) {
            map.once('moveend', apply);
            return () => {
                map.off('moveend', apply);
            };
        }
        apply();
    }, [bottomPadding]);
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
    // The style's own sources, to tell a base-map failure from an overlay's (null for a style URL: any source counts)
    const baseSourceIds = useMemo(() => (typeof resolvedMapStyle === 'string' ? null : new Set(Object.keys(resolvedMapStyle.sources))), [resolvedMapStyle]);
    const styleKey = useMemo(() => mapStyleKey(resolvedMapStyle), [resolvedMapStyle]);
    const availability = useMapAvailability(baseSourceIds, styleKey);

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
        if (popupPosition || rulerActive || drawing || e.features?.length) return;

        setPopupPosition(e.lngLat);
    }

    return (
        <div className={cn('relative', className ?? "w-dvw h-dvh")} style={wrapperStyle} {...tourTarget('map')}>
            <Maplibre
                ref={mapRef}
                reuseMaps
                initialViewState={DEFAULT_VIEW}
                style={{width: '100%', height: '100%'}}
                attributionControl={false}
                // Dutch labels for MapLibre's own control buttons (screen readers read their names)
                locale={MAP_LOCALE_NL}
                mapStyle={resolvedMapStyle}
                maxBounds={maxBounds}
                maxPitch={ORBIT_MAX_PITCH}
                interactive={!wall}
                onClick={wall ? undefined : openPopup}
                interactiveLayerIds={INTERACTIVE_LAYER_IDS}
                // No symbol fade: every tracker poll moves the hunter icons, which then faded in again (about 20 extra
                // full map repaints per poll); the HTML markers they replace moved instantly
                fadeDuration={0}
                onError={availability.onError}
                onSourceData={availability.onSourceData}
                // Phones and the HQ wall: start with the credits collapsed to the (i) button; MapLibre opens them on load
                onLoad={(event) => {
                    if (isMobile || wall) event.target.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
                    event.target.setPadding({top: 0, left: 0, right: 0, bottom: bottomPadding});
                }}
            >
                <div className="bg-background">
                    {/* Credits on the right: bottom-right on desktop; on phones top-right, above the bottom sheet; on the HQ wall top-right, above the event card. */}
                    <AttributionControl position={isMobile || wall ? 'top-right' : 'bottom-right'} customAttribution={groupName ? `Jotihunt Tracker | ${groupName}` : 'Jotihunt Tracker'} compact={true}/>
                </div>
                {/* Phones: no MapLibre controls (touch navigation, the sheet needs the room); MyLocationButton floats above the sheet */}
                {!isMobile && !wall && (
                    <>
                        <ScaleControl/>
                        {/* Bottom corners stack upwards (the last added control ends up on top), so add bottom-to-top:
                            credits (above), ruler, fullscreen, my location, zoom, map style and layers */}
                        <Ruler linePaint={RULER_LINE_PAINT} markerPaint={RULER_MARKER_PAINT}
                               labelLayout={RULER_LABEL_LAYOUT} labelPaint={RULER_LABEL_PAINT}
                               position="bottom-right" onActivate={activateRuler}
                               onDeactivate={deactivateRuler} disabled={drawing}/>
                        <FullscreenControl position="bottom-right"/>
                        <GeolocateControl position="bottom-right"/>
                        <NavigationControl position="bottom-right" showCompass={false}/>
                        {/* Pops in above zoom while the map is turned or tilted */}
                        <ResetNorthControl position="bottom-right"/>
                        <MapLayersControl position="bottom-right"/>
                    </>
                )}
                {/* Before the layers, so it listens for their images from the start */}
                <MarkerImages/>
                {/* Desktop mouse: calm rotate/tilt around the pointer (phones keep MapLibre's touch gestures) */}
                <OrbitControls enabled={!isMobile && !wall}/>
                {/* Turned or tilted (touch twist, orbit, 3D tilt): the reset-north tile shows (desktop stack, phone dock) */}
                {!wall && <MapRotationTracker/>}
                {popupPosition && !wall && <PickedLocationPopup key={`${popupPosition.lng},${popupPosition.lat}`} lng={popupPosition.lng} lat={popupPosition.lat}
                                                       onClose={() => setPopupPosition(undefined)}/>}
                <Buildings3D visible={showBuildings3d}/>
                {showPredictions && predictionEnabled !== false && <Predictions/>}
                <Reach visible={showReach && !wall}/>
                {showTeams && <Teams/>}
                {(showMcDonalds || showKfc || showBurgerKing) && <FastFood/>}
                {showDevices && <Devices/>}
                {showLife360 && <Life360/>}
                {(showMarkersPart1 || showMarkersPart2) && <Markers part1={showMarkersPart1} part2={showMarkersPart2}/>}
                {(showMarkersPart1 || showMarkersPart2) && <HuntAccuracy/>}
                <HomeCircle showCircle={showHomeCircle}/>
                {!wall && <HuntFocus/>}
                {!wall && <HintGuess/>}
                {isAdmin && <NightAreasLayer/>}
                <AnimatePresence>{drawing && <NightAreaDraw key="draw"/>}</AnimatePresence>
                <LayerStack/>
                {overlay}
            </Maplibre>
            {/* Style or tiles failed (offline cold start, tile server down): say so instead of a blank map */}
            <div className="pointer-events-none absolute inset-x-4 top-[30%] z-10 flex justify-center">
                <AnimatePresence>{availability.unavailable && <MapUnavailableCard key="unavailable"/>}</AnimatePresence>
            </div>
        </div>
    );
}));

export default Map;
