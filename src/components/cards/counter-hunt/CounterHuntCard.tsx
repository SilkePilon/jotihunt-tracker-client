import { Eye, Trash } from 'lucide-react';
import { Button } from '../../ui/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select.tsx';
import useCounterHuntStore from '@/stores/counterhunt.store.ts';
import { useState } from 'react';
import PropTypes, { InferProps } from 'prop-types';
import { MapRef } from '@/components/Map.tsx';
import useSidebarStore from '@/stores/sidebar.store.ts';
import { useTeams } from '@/hooks/teams.hook.ts';

export default function CounterHuntCard({ mapRef }: InferProps<typeof CounterHuntCard.propTypes>) {
  // Home coordinates for zooming to the counter hunt
  const { teams } = useTeams();
  const homeTeam = teams?.find((team) => team.apiId == import.meta.env.HOME_TEAM_API_ID);

  const setSheetSnap = useSidebarStore((state) => state.setSheetSnap);
  const { direction, setDirection, setVisible } = useCounterHuntStore();
  const [chosenDirection, setChosenDirection] = useState(direction);

  /**
   * Show the counter hunt on the map.
   * Sets the zustand store to visible, sets the direction and makes sure the layer is enabled on the map.
   */
  function showCounterHunt() {
    setVisible(true);
    setDirection(chosenDirection);
    if (homeTeam) {
      mapRef.current?.flyTo({
        center: [homeTeam?.location.coordinates[0], homeTeam?.location.coordinates[1]],
        duration: 2000,
        zoom: 16,
      });
    }
    setSheetSnap('peek');
  }

  /**
   * Remove the counter hunt from the map.
   */
  function removeCounterHunt() {
    setVisible(false);
    setDirection(0);
  }

  return (
    <div className="flex w-full items-center gap-2">
      <Select onValueChange={(value) => setChosenDirection(Number(value))} value={chosenDirection.toString()}>
        <SelectTrigger className="w-full min-w-0 flex-1" aria-label="Windrichting">
          <SelectValue placeholder="Kies windrichting..." />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="0">N - Noord</SelectItem>
            <SelectItem value="45">NO - Noordoost</SelectItem>
            <SelectItem value="90">O - Oost</SelectItem>
            <SelectItem value="135">ZO - Zuidoost</SelectItem>
            <SelectItem value="180">Z - Zuid</SelectItem>
            <SelectItem value="225">ZW - Zuidwest</SelectItem>
            <SelectItem value="270">W - West</SelectItem>
            <SelectItem value="315">NW - Noordwest</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button onClick={showCounterHunt}>
        <Eye data-icon="inline-start" />
        Toon
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Tegenhunt verwijderen" onClick={removeCounterHunt}>
            <Trash />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Tegenhunt verwijderen</TooltipContent>
      </Tooltip>
    </div>
  );
}

CounterHuntCard.propTypes = {
  mapRef: PropTypes.object.isRequired as PropTypes.Validator<React.RefObject<MapRef | null>>,
};
