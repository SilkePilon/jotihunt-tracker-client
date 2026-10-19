import { createPortal } from 'react-dom';
import { useState } from 'react';
import { useControl, type ControlPosition } from 'react-map-gl/maplibre';
import type { IControl } from 'maplibre-gl';
import { LayersIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { tourTarget } from '@/components/tour/targets';
import MapLayersPanel from '@/components/map/layers/MapLayersPanel';

/** An empty control-group box in MapLibre's control corner; the button is portalled into it. */
class PortalControl implements IControl {
  readonly container = document.createElement('div');

  onAdd() {
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group map-layers-ctrl';
    return this.container;
  }

  onRemove() {
    this.container.remove();
  }
}

/** Map button (desktop) that opens the map style and layers panel. */
export default function MapLayersControl({ position = 'bottom-right' }: { position?: ControlPosition }) {
  const control = useControl(() => new PortalControl(), { position });
  const [open, setOpen] = useState(false);

  return createPortal(
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Kaartstijl en lagen" title="Kaartstijl en lagen" {...tourTarget('map.layersButton')} className="flex! items-center justify-center text-foreground">
          <LayersIcon className="size-[18px]" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="end"
        sideOffset={8}
        className="flex max-h-(--radix-popover-content-available-height) w-[330px] flex-col overflow-y-auto"
      >
        <MapLayersPanel fetchLife360={open} />
      </PopoverContent>
    </Popover>,
    control.container,
  );
}
