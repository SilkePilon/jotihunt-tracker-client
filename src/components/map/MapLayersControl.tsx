import { createPortal } from 'react-dom';
import { useState } from 'react';
import { useControl, type ControlPosition } from 'react-map-gl/maplibre';
import type { IControl } from 'maplibre-gl';
import { AnimatePresence, motion } from 'motion/react';
import { LayersIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import useSettingsStore from '@/stores/settings.store';
import { useDarkMode } from '@/hooks/utils/darkmode.hook';
import { useLayerToggles } from '@/components/settings/layer-toggles';
import { MapStyle } from '@/types/MapStyle';
import { POP_SPRING, SWAP_TRANSITION } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { tourTarget } from '@/components/tour/targets';
import materialLightThumb from '@/assets/map-styles/material-light.webp';
import materialDarkThumb from '@/assets/map-styles/material-dark.webp';
import streetsThumb from '@/assets/map-styles/streets.webp';
import outdoorsThumb from '@/assets/map-styles/outdoors.webp';
import satelliteThumb from '@/assets/map-styles/satellite.webp';
import darkThumb from '@/assets/map-styles/dark.webp';

/** An empty control-group box in MapLibre's control corner; the button is portalled into it. */
class PortalControl implements IControl {
  readonly container = document.createElement('div');

  onAdd() {
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    return this.container;
  }

  onRemove() {
    this.container.remove();
  }
}

/** '' = automatic: the Material map, light or dark with the theme. Thumbnails show Wageningen at z13. */
const STYLES: { value: MapStyle | ''; label: string; thumb: string; darkThumb?: string }[] = [
  { value: '', label: 'Automatisch', thumb: materialLightThumb, darkThumb: materialDarkThumb },
  { value: MapStyle.Streets, label: 'Straten', thumb: streetsThumb },
  { value: MapStyle.Outdoors, label: 'Outdoor', thumb: outdoorsThumb },
  { value: MapStyle.Satellite, label: 'Satelliet', thumb: satelliteThumb },
  { value: MapStyle.Dark, label: 'Donker', thumb: darkThumb },
];

/** Map button (desktop) that opens the map styles as thumbnails and the layers as switches, one click away. */
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
      <PopoverContent side="left" align="end" sideOffset={8} className="w-80 p-3">
        <StylePicker />
        <div className="my-3 h-px bg-border" />
        <LayerSwitches fetchLife360={open} />
      </PopoverContent>
    </Popover>,
    control.container,
  );
}

function StylePicker() {
  const mapStyle = useSettingsStore((state) => state.mapStyle);
  const setMapStyle = useSettingsStore((state) => state.setMapStyle);
  const isDarkMode = useDarkMode();

  return (
    <section>
      <h3 className="mb-2 text-xs font-medium text-muted-foreground">Kaartstijl</h3>
      <div role="radiogroup" aria-label="Kaartstijl" className="grid grid-cols-3 gap-2">
        {STYLES.map((style) => {
          const selected = mapStyle === style.value;
          return (
            <button
              key={style.value || 'auto'}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setMapStyle(style.value as MapStyle)}
              className="group flex flex-col items-center gap-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="relative block w-full">
                <img
                  src={isDarkMode && style.darkThumb ? style.darkThumb : style.thumb}
                  alt=""
                  draggable={false}
                  className="aspect-[4/3] w-full rounded-lg border border-border object-cover transition-transform duration-200 group-hover:scale-[1.04]"
                />
                {selected && (
                  <motion.span
                    layoutId="map-style-selected"
                    aria-hidden
                    className="pointer-events-none absolute -inset-[3px] rounded-[11px] border-2 border-primary"
                    transition={POP_SPRING}
                  />
                )}
              </span>
              <span className={cn('text-xs transition-colors', selected ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                {style.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function LayerSwitches({ fetchLife360 }: { fetchLife360: boolean }) {
  const toggles = useLayerToggles(fetchLife360);

  return (
    <section>
      <h3 className="mb-1 text-xs font-medium text-muted-foreground">Lagen</h3>
      <ul>
        <AnimatePresence initial={false}>
          {toggles.map((layer) => (
            <motion.li
              key={layer.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={SWAP_TRANSITION}
              className="overflow-hidden"
            >
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-1 py-1.5 text-sm transition-colors hover:bg-accent">
                {layer.label}
                <Switch size="sm" checked={layer.checked} onCheckedChange={layer.toggle} />
              </label>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}
