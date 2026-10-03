import { EyeIcon } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import {
  DropdownMenuCheckboxItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import useLayersStore from '@/stores/layers.store';
import { usePredictionSetting } from '@/hooks/predictions.hook';

/** Keep the menu open while toggling layers */
const keepOpen = (e: Event) => e.preventDefault();

/** Settings → Zichtbare lagen: toggles for each map layer. */
export default function LayersSubmenu() {
  const layers = useLayersStore(
    useShallow((state) => ({
      showTeams: state.showTeams,
      showDevices: state.showDevices,
      showMarkersPart1: state.showMarkersPart1,
      showMarkersPart2: state.showMarkersPart2,
      showHomeCircle: state.showHomeCircle,
      showGroupCircles: state.showGroupCircles,
      showPredictions: state.showPredictions,
      toggleTeams: state.toggleTeams,
      toggleDevices: state.toggleDevices,
      toggleMarkersPart1: state.toggleMarkersPart1,
      toggleMarkersPart2: state.toggleMarkersPart2,
      toggleHomeCircle: state.toggleHomeCircle,
      toggleGroupCircles: state.toggleGroupCircles,
      togglePredictions: state.togglePredictions,
    })),
  );
  const { enabled: predictionEnabled } = usePredictionSetting();

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <EyeIcon />
        Zichtbare lagen
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent>
          <DropdownMenuCheckboxItem checked={layers.showTeams} onCheckedChange={layers.toggleTeams} onSelect={keepOpen}>
            Deelnemende groepen
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={layers.showDevices} onCheckedChange={layers.toggleDevices} onSelect={keepOpen}>
            Huidige locatie auto's
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={layers.showMarkersPart1} onCheckedChange={layers.toggleMarkersPart1} onSelect={keepOpen}>
            Markers (speelhelft 1)
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={layers.showMarkersPart2} onCheckedChange={layers.toggleMarkersPart2} onSelect={keepOpen}>
            Markers (speelhelft 2)
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={layers.showHomeCircle} onCheckedChange={layers.toggleHomeCircle} onSelect={keepOpen}>
            Tegenhunt cirkel
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={layers.showGroupCircles} onCheckedChange={layers.toggleGroupCircles} onSelect={keepOpen}>
            Groepen cirkels
          </DropdownMenuCheckboxItem>
          {predictionEnabled !== false && (
            <DropdownMenuCheckboxItem checked={layers.showPredictions} onCheckedChange={layers.togglePredictions} onSelect={keepOpen}>
              Voorspelling
            </DropdownMenuCheckboxItem>
          )}
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
