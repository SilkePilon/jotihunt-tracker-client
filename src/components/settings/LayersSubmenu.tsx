import { EyeIcon } from 'lucide-react';
import { DropdownMenuCheckboxItem, DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import BeheerSwitch from '@/components/beheer/controls/BeheerSwitch';
import { useLayerToggles } from './layer-toggles';
import { MenuRows, MenuSubRow, SUBMENU_SIDE_OFFSET } from './menu-parts';

/** Keep the menu open while toggling layers */
const keepOpen = (e: Event) => e.preventDefault();

/** Settings → Zichtbare lagen (phones): Beheer rows with an M3 switch per map layer. */
export default function LayersSubmenu() {
  // Fetched while the settings menu is open, so the Life360 item also appears when the layer is off
  const toggles = useLayerToggles(true);

  return (
    <DropdownMenuSub>
      <MenuSubRow>
        <EyeIcon />
        Zichtbare lagen
      </MenuSubRow>
      <DropdownMenuPortal>
        <DropdownMenuSubContent sideOffset={SUBMENU_SIDE_OFFSET} className="w-[270px]">
          <MenuRows>
            {toggles.map((layer) => (
              // The row is the menuitemcheckbox; the switch is only its picture (the built-in check indicator is hidden)
              <DropdownMenuCheckboxItem
                key={layer.id}
                checked={layer.checked}
                onCheckedChange={layer.toggle}
                onSelect={keepOpen}
                className="justify-between py-2 [&>[data-slot=dropdown-menu-item-indicator]]:hidden"
              >
                {layer.label}
                <BeheerSwitch checked={layer.checked} tabIndex={-1} aria-hidden className="pointer-events-none" />
              </DropdownMenuCheckboxItem>
            ))}
          </MenuRows>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
