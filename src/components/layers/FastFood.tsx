import { useMemo, useState } from 'react';
import { Layer, Source, useMap, type SymbolLayerSpecification } from 'react-map-gl/maplibre';
import { useShallow } from 'zustand/react/shallow';
import { useFastfood } from '@/hooks/fastfood.hook';
import { useNow } from '@/hooks/now.hook';
import { shownBrands } from '@/lib/fastfood';
import { FASTFOOD_HOVER_LAYER, FASTFOOD_LAYER, fastfoodFeatures } from '@/lib/map-layers';
import { themedIconExpression } from '@/lib/marker-style';
import useLayersStore from '@/stores/layers.store';
import { useBrandLogosReady } from './brand-logos';
import { featureId, useLayerInteractions, usePopupSelection } from './map-interactions';
import { useMarkerTheme } from './marker-icons';
import FastFoodPopup from './fastfood/FastFoodPopup';
import FastFoodTooltip from './fastfood/FastFoodTooltip';

const FASTFOOD_SOURCE = 'fastfood';
const INTERACTIVE_LAYERS = [FASTFOOD_LAYER];
/** Open/closed is re-evaluated every minute */
const TICK_MS = 60_000;

/**
 * McDonald's, KFC and Burger King as brand tiles (one GeoJSON source + symbol layer, like the groups). Waits for the
 * logos, so no icon is drawn without one; fetches only while at least one brand is on.
 */
export default function FastFood() {
  const flags = useLayersStore(useShallow((state) => ({ showMcDonalds: state.showMcDonalds, showKfc: state.showKfc, showBurgerKing: state.showBurgerKing })));
  const brands = useMemo(() => shownBrands(flags), [flags]);
  const restaurants = useFastfood(brands.length > 0);
  const logosReady = useBrandLogosReady();
  const nowMs = useNow(true, TICK_MS);
  const map = useMap().current?.getMap();
  const theme = useMarkerTheme();
  const layout = useMemo<SymbolLayerSpecification['layout']>(() => ({ 'icon-image': themedIconExpression(theme), 'icon-allow-overlap': true, 'icon-ignore-placement': true }), [theme]);
  const hoverLayout = useMemo<SymbolLayerSpecification['layout']>(() => ({ ...layout, 'icon-size': 1.1 }), [layout]);

  const { active, open: openPopup, close: closePopup, dismiss: dismissPopup } = usePopupSelection<string>();
  const [hoveredId, setHoveredId] = useState<string>();
  const activeRestaurant = active ? restaurants?.find((restaurant) => restaurant.osmId === active.id && brands.includes(restaurant.brand)) : undefined;
  const hoveredRestaurant = hoveredId !== undefined && !activeRestaurant ? restaurants?.find((restaurant) => restaurant.osmId === hoveredId) : undefined;

  const features = useMemo(() => fastfoodFeatures(restaurants ?? [], brands, nowMs), [restaurants, brands, nowMs]);
  const hoverFilter = useMemo<SymbolLayerSpecification['filter']>(() => ['==', ['get', 'id'], hoveredId ?? ''], [hoveredId]);

  useLayerInteractions(map, INTERACTIVE_LAYERS, {
    onClick: (feature) => {
      const id = featureId(feature);
      const restaurant = typeof id === 'string' ? restaurants?.find((candidate) => candidate.osmId === id) : undefined;
      if (!restaurant) return;
      setHoveredId(undefined);
      if (restaurant.osmId === activeRestaurant?.osmId) {
        dismissPopup();
        return;
      }
      openPopup(restaurant.osmId);
      map?.easeTo({ center: restaurant.location.coordinates, duration: 600 });
    },
    onHover: (feature) => {
      const id = featureId(feature);
      setHoveredId(typeof id === 'string' ? id : undefined);
    },
  });

  if (!brands.length || !logosReady) return null;
  return (
    <>
      <Source id={FASTFOOD_SOURCE} type="geojson" data={features}>
        <Layer id={FASTFOOD_LAYER} type="symbol" source={FASTFOOD_SOURCE} layout={layout} />
        <Layer id={FASTFOOD_HOVER_LAYER} type="symbol" source={FASTFOOD_SOURCE} layout={hoverLayout} filter={hoverFilter} />
      </Source>
      {hoveredRestaurant && <FastFoodTooltip restaurant={hoveredRestaurant} nowMs={nowMs} />}
      {activeRestaurant && <FastFoodPopup key={active!.opened} restaurant={activeRestaurant} nowMs={nowMs} onClose={closePopup} />}
    </>
  );
}
