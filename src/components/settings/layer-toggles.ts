import { useShallow } from 'zustand/react/shallow';
import useLayersStore from '@/stores/layers.store';
import { useLife360Members } from '@/hooks/life360.hook';
import { usePredictionSetting } from '@/hooks/predictions.hook';

export interface LayerToggle {
  id: string;
  label: string;
  checked: boolean;
  toggle: () => void;
}

/**
 * The map layers the user can show or hide, in menu order. Voorspelling only while predictions are on,
 * Life360 only with a linked account.
 * @param fetchLife360 Fetch the Life360 members (while the menu is open), so the item also appears when the layer is off
 */
export function useLayerToggles(fetchLife360: boolean): LayerToggle[] {
  const layers = useLayersStore(
    useShallow((state) => ({
      showTeams: state.showTeams,
      showDevices: state.showDevices,
      showMarkersPart1: state.showMarkersPart1,
      showMarkersPart2: state.showMarkersPart2,
      showHomeCircle: state.showHomeCircle,
      showGroupCircles: state.showGroupCircles,
      showPredictions: state.showPredictions,
      showLife360: state.showLife360,
      showBuildings3d: state.showBuildings3d,
      showMcDonalds: state.showMcDonalds,
      showKfc: state.showKfc,
      showBurgerKing: state.showBurgerKing,
      toggleTeams: state.toggleTeams,
      toggleDevices: state.toggleDevices,
      toggleMarkersPart1: state.toggleMarkersPart1,
      toggleMarkersPart2: state.toggleMarkersPart2,
      toggleHomeCircle: state.toggleHomeCircle,
      toggleGroupCircles: state.toggleGroupCircles,
      togglePredictions: state.togglePredictions,
      toggleLife360: state.toggleLife360,
      toggleBuildings3d: state.toggleBuildings3d,
      toggleMcDonalds: state.toggleMcDonalds,
      toggleKfc: state.toggleKfc,
      toggleBurgerKing: state.toggleBurgerKing,
    })),
  );
  const { enabled: predictionEnabled } = usePredictionSetting();
  const { data: life360 } = useLife360Members(fetchLife360);

  const toggles: LayerToggle[] = [
    { id: 'teams', label: 'Deelnemende groepen', checked: layers.showTeams, toggle: layers.toggleTeams },
    { id: 'devices', label: "Huidige locatie auto's", checked: layers.showDevices, toggle: layers.toggleDevices },
    { id: 'markers1', label: 'Markers (speelhelft 1)', checked: layers.showMarkersPart1, toggle: layers.toggleMarkersPart1 },
    { id: 'markers2', label: 'Markers (speelhelft 2)', checked: layers.showMarkersPart2, toggle: layers.toggleMarkersPart2 },
    { id: 'homeCircle', label: 'Tegenhunt cirkel', checked: layers.showHomeCircle, toggle: layers.toggleHomeCircle },
    { id: 'groupCircles', label: 'Groepen cirkels', checked: layers.showGroupCircles, toggle: layers.toggleGroupCircles },
    { id: 'buildings3d', label: '3D-gebouwen', checked: layers.showBuildings3d, toggle: layers.toggleBuildings3d },
  ];
  if (predictionEnabled !== false) {
    toggles.push({ id: 'predictions', label: 'Voorspelling', checked: layers.showPredictions, toggle: layers.togglePredictions });
  }
  if (life360?.linked) {
    toggles.push({ id: 'life360', label: 'Life360', checked: layers.showLife360, toggle: layers.toggleLife360 });
  }
  toggles.push(
    { id: 'mcdonalds', label: "McDonald's", checked: layers.showMcDonalds, toggle: layers.toggleMcDonalds },
    { id: 'kfc', label: 'KFC', checked: layers.showKfc, toggle: layers.toggleKfc },
    { id: 'burgerking', label: 'Burger King', checked: layers.showBurgerKing, toggle: layers.toggleBurgerKing },
  );
  return toggles;
}
