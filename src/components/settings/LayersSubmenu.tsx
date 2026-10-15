import { EyeIcon } from 'lucide-react';
import {
  DropdownMenuCheckboxItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { useLayerToggles } from './layer-toggles';

/** Keep the menu open while toggling layers */
const keepOpen = (e: Event) => e.preventDefault();

/** Settings → Zichtbare lagen: toggles for each map layer. */
export default function LayersSubmenu() {
  // Fetched while the settings menu is open, so the Life360 item also appears when the layer is off
  const toggles = useLayerToggles(true);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <EyeIcon />
        Zichtbare lagen
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent>
          {toggles.map((layer) => (
            <DropdownMenuCheckboxItem key={layer.id} checked={layer.checked} onCheckedChange={layer.toggle} onSelect={keepOpen}>
              {layer.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
