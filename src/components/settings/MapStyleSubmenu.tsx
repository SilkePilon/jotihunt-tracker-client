import { LayersIcon } from 'lucide-react';
import { DropdownMenuPortal, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSub, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import useSettingsStore from '@/stores/settings.store';
import { MapStyle } from '@/types/MapStyle';
import { MenuSubRow, SUBMENU_SIDE_OFFSET } from './menu-parts';

const STYLES: { value: MapStyle | ''; label: string }[] = [
  { value: '', label: 'Automatisch (Material)' },
  { value: MapStyle.Streets, label: 'Straten' },
  { value: MapStyle.Outdoors, label: 'Outdoor' },
  { value: MapStyle.Satellite, label: 'Satelliet' },
];

/** Settings → Kaartstijl (phones): pick the map style ('' = automatic: the Material map, light or dark with the theme). */
export default function MapStyleSubmenu() {
  const mapStyle = useSettingsStore((state) => state.mapStyle);
  const setMapStyle = useSettingsStore((state) => state.setMapStyle);

  return (
    <DropdownMenuSub>
      <MenuSubRow>
        <LayersIcon />
        Kaartstijl
      </MenuSubRow>
      <DropdownMenuPortal>
        <DropdownMenuSubContent sideOffset={SUBMENU_SIDE_OFFSET} className="w-[240px]">
          <DropdownMenuRadioGroup value={mapStyle} onValueChange={(style) => setMapStyle(style as MapStyle)}>
            {STYLES.map((style) => (
              <DropdownMenuRadioItem key={style.value} value={style.value}>
                {style.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
