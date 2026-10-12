import { LayersIcon } from 'lucide-react';
import {
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import useSettingsStore from '@/stores/settings.store';
import { MapStyle } from '@/types/MapStyle';

/** Settings → Kaartstijl: pick the map style ('' = automatic: the Material map, light or dark with the theme). */
export default function MapStyleSubmenu() {
  const mapStyle = useSettingsStore((state) => state.mapStyle);
  const setMapStyle = useSettingsStore((state) => state.setMapStyle);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <LayersIcon />
        Kaartstijl
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup value={mapStyle} onValueChange={(style) => setMapStyle(style as MapStyle)}>
            <DropdownMenuRadioItem value={''}>Automatisch (Material)</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value={MapStyle.Streets}>Straten</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value={MapStyle.Outdoors}>Outdoor</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value={MapStyle.Satellite}>Satelliet</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value={MapStyle.Dark}>Donker</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
