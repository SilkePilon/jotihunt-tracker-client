import Maplibre, {
    AttributionControl,
    GeolocateControl,
    NavigationControl,
    ScaleControl,
    MapRef as MaplibreRef,
} from 'react-map-gl/maplibre';

import 'maplibre-gl/dist/maplibre-gl.css';

import type {LngLat, MapMouseEvent, Map as MaplibreMap, StyleSpecification} from 'maplibre-gl';
import Teams from './layers/Teams';
import Devices from './layers/Devices';
import Markers from './layers/Markers';
import {forwardRef, useEffect, useImperativeHandle, useRef, useState} from 'react';
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
import ImageControl from "@/components/map/ImageControl.tsx";
import {DEFAULT_VIEW} from '@/lib/map-view';

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

const IMAGE_CONTROL_LAYER_PREFIXES = ['$fill:', '$contour:', '$knobs:'];

const Map = forwardRef<MapRef>((_, ref) => {

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
    const {showTeams, showDevices, showMarkersPart1, showMarkersPart2, showHomeCircle, showPredictions} = useLayersStore();
    const {enabled: predictionEnabled} = usePredictionSetting();
    const [popupPosition, setPopupPosition] = useState<LngLat>();
    const [rulerActive, setRulerActive] = useState<boolean>(false);

    // Store for settings
    const {mapStyle} = useSettingsStore();
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
    function openPopup(e: MapMouseEvent) {
        if (popupPosition || rulerActive) return;

        const isCtrlPressed = e.originalEvent.ctrlKey;
        const clickedFeatures = mapRef.current?.queryRenderedFeatures(e.point) ?? [];
        const isImageControlClick = clickedFeatures.some((feature) => {
            const layerId = feature.layer?.id ?? '';
            return IMAGE_CONTROL_LAYER_PREFIXES.some((prefix) => layerId.startsWith(prefix));
        });

        if (!isCtrlPressed && isImageControlClick) return;

        setPopupPosition(e.lngLat);
    }

    return (
        <div className="w-dvw h-dvh">
            <Maplibre
                ref={mapRef}
                reuseMaps
                initialViewState={DEFAULT_VIEW}
                style={{width: '100%', height: '100%'}}
                attributionControl={false}
                mapStyle={resolvedMapStyle}
                maxBounds={maxBounds}
                onClick={openPopup}
                // Phones: start with the credits collapsed to the (i) button; MapLibre opens them on load
                onLoad={(event) => {
                    if (isMobile) event.target.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
                }}
            >
                {/* Phones: no map controls, the map is navigated by touch and the bottom sheet needs the room */}
                {!isMobile && (
                    <>
                        <NavigationControl/>
                        <ScaleControl/>
                        <GeolocateControl/>
                        <FullscreenControl/>
                        <ImageControl/>
                        <Ruler linePaint={{
                            'line-color': '#1473e8',
                        }} position={"top-right"} onActivate={() => setRulerActive(true)}
                               onDeactivate={() => setRulerActive(false)}/>
                    </>
                )}
                <div className="bg-background">
                    {/* Credits on the right: bottom-right on desktop; on phones top-right, above the bottom sheet. */}
                    <AttributionControl position={isMobile ? 'top-right' : 'bottom-right'} customAttribution={GROUP_NAME ? `Jotihunt Tracker | ${GROUP_NAME}` : 'Jotihunt Tracker'} compact={true}/>
                </div>
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
