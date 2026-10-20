import { Building2Icon, CarIcon, CircleDashedIcon, MapPinIcon, RadarIcon, SparklesIcon, TargetIcon, UserRoundIcon, UsersIcon, type LucideIcon } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import useLayersStore, { type LayersState } from '@/stores/layers.store';
import { useLife360Members } from '@/hooks/life360.hook';
import { usePredictionSetting } from '@/hooks/predictions.hook';
import { BRAND_LABEL, BRANDS, type Brand } from '@/lib/fastfood';

export interface SwitchRow {
  kind: 'switch';
  id: string;
  label: string;
  icon: LucideIcon;
  checked: boolean;
  toggle: () => void;
}

export interface MarkersRow {
  kind: 'markers';
  id: 'markers';
  label: string;
  icon: LucideIcon;
  parts: { id: 'markers1' | 'markers2'; label: string; ariaLabel: string; checked: boolean; toggle: () => void }[];
}

export type LayerRow = SwitchRow | MarkersRow;

export interface LayerGroup {
  id: 'game' | 'team';
  title: string;
  rows: LayerRow[];
}

export interface FoodToggle {
  brand: Brand;
  label: string;
  checked: boolean;
  toggle: () => void;
}

export interface LayerGroups {
  groups: LayerGroup[];
  food: { title: string; toggles: FoodToggle[] };
}

/** The layers store: every show flag and its toggle. */
export type LayerFlags = LayersState;

const sw = (id: string, label: string, icon: LucideIcon, checked: boolean, toggle: () => void): SwitchRow => ({ kind: 'switch', id, label, icon, checked, toggle });

/**
 * The map layers for the layers panel, grouped (Spel, Team & kaart) plus the fastfood brands (Eten). Voorspelling only
 * while predictions are on, Bereik vossen always, Life360 only with a linked account.
 */
export function layerGroups(layers: LayerFlags, options: { predictions: boolean; life360: boolean }): LayerGroups {
  const game: LayerRow[] = [
    sw('teams', 'Groepen', UsersIcon, layers.showTeams, layers.toggleTeams),
    sw('groupCircles', 'Groepscirkels', CircleDashedIcon, layers.showGroupCircles, layers.toggleGroupCircles),
    sw('homeCircle', 'Tegenhunt-cirkel', TargetIcon, layers.showHomeCircle, layers.toggleHomeCircle),
    {
      kind: 'markers',
      id: 'markers',
      label: 'Markers',
      icon: MapPinIcon,
      parts: [
        { id: 'markers1', label: '1', ariaLabel: 'Speelhelft 1', checked: layers.showMarkersPart1, toggle: layers.toggleMarkersPart1 },
        { id: 'markers2', label: '2', ariaLabel: 'Speelhelft 2', checked: layers.showMarkersPart2, toggle: layers.toggleMarkersPart2 },
      ],
    },
  ];
  if (options.predictions) game.push(sw('predictions', 'Voorspelling', SparklesIcon, layers.showPredictions, layers.togglePredictions));
  game.push(sw('reach', 'Bereik vossen', RadarIcon, layers.showReach, layers.toggleReach));

  const team: LayerRow[] = [sw('devices', "Auto's", CarIcon, layers.showDevices, layers.toggleDevices)];
  if (options.life360) team.push(sw('life360', 'Life360', UserRoundIcon, layers.showLife360, layers.toggleLife360));
  team.push(sw('buildings3d', '3D-gebouwen', Building2Icon, layers.showBuildings3d, layers.toggleBuildings3d));

  const shown: Record<Brand, [boolean, () => void]> = {
    mcdonalds: [layers.showMcDonalds, layers.toggleMcDonalds],
    kfc: [layers.showKfc, layers.toggleKfc],
    burgerking: [layers.showBurgerKing, layers.toggleBurgerKing],
  };

  return {
    groups: [
      { id: 'game', title: 'Spel', rows: game },
      { id: 'team', title: 'Team & kaart', rows: team },
    ],
    food: { title: 'Eten', toggles: BRANDS.map((brand) => ({ brand, label: BRAND_LABEL[brand], checked: shown[brand][0], toggle: shown[brand][1] })) },
  };
}

/**
 * The grouped layers for the panel.
 * @param fetchLife360 Fetch the Life360 members (while the panel is open), so the row also appears when the layer is off
 */
export function useLayerGroups(fetchLife360: boolean): LayerGroups {
  const layers = useLayersStore(useShallow((state) => state));
  const { enabled: predictionEnabled } = usePredictionSetting();
  const { data: life360 } = useLife360Members(fetchLife360);
  return layerGroups(layers, { predictions: predictionEnabled !== false, life360: !!life360?.linked });
}
