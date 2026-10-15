import { LayersIcon } from 'lucide-react';
import { DropdownMenuPortal, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSub, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import useSettingsStore from '@/stores/settings.store';
import { MapStyle } from '@/types/MapStyle';
import { cn } from '@/lib/utils';
import { MENU_CARD, MENU_ROW, MenuSubRow } from './menu-parts';

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
        <DropdownMenuSubContent className={cn(MENU_CARD, 'w-[240px]')}>
          {/* The chosen style is the light-orange row (built-in radio dot hidden) */}
          <DropdownMenuRadioGroup value={mapStyle} onValueChange={(style) => setMapStyle(style as MapStyle)} className="flex flex-col gap-0.5">
            {STYLES.map((style) => (
              <DropdownMenuRadioItem
                key={style.value}
                value={style.value}
                className={cn(
                  MENU_ROW,
                  'pl-3 [&>span:first-child]:hidden data-[state=checked]:bg-(--map-selected-bg) data-[state=checked]:text-(--map-selected-fg)',
                )}
              >
                {style.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
