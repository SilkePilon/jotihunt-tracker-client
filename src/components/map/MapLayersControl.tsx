import { createPortal } from 'react-dom';
import { useState } from 'react';
import { useControl, type ControlPosition } from 'react-map-gl/maplibre';
import type { IControl } from 'maplibre-gl';
import { motion } from 'motion/react';
import { LayersIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import useSettingsStore from '@/stores/settings.store';
import { useDarkMode } from '@/hooks/utils/darkmode.hook';
import { useLayerToggles } from '@/components/settings/layer-toggles';
import { MapStyle } from '@/types/MapStyle';
import { POP_SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { tourTarget } from '@/components/tour/targets';
import { BeheerRows, RowFrame } from '@/components/beheer/BeheerLayout';
import BeheerSwitch from '@/components/beheer/controls/BeheerSwitch';
import materialLightThumb from '@/assets/map-styles/material-light.webp';
import materialDarkThumb from '@/assets/map-styles/material-dark.webp';
import streetsThumb from '@/assets/map-styles/streets.webp';
import outdoorsThumb from '@/assets/map-styles/outdoors.webp';
import satelliteThumb from '@/assets/map-styles/satellite.webp';

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

/** '' = automatic: the Material map, light or dark with the theme. Thumbnails show Wageningen at z13. */
const STYLES: { value: MapStyle | ''; label: string; name: string; thumb: string; darkThumb?: string }[] = [
  { value: '', label: 'Auto', name: 'Automatisch', thumb: materialLightThumb, darkThumb: materialDarkThumb },
  { value: MapStyle.Streets, label: 'Straten', name: 'Straten', thumb: streetsThumb },
  { value: MapStyle.Outdoors, label: 'Outdoor', name: 'Outdoor', thumb: outdoorsThumb },
  { value: MapStyle.Satellite, label: 'Satelliet', name: 'Satelliet', thumb: satelliteThumb },
];

/** Map button (desktop) that opens the map styles and layers in a Beheer-style card, one click away. */
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
      {/* Beheer card: 24px corners, hairline + soft shadow instead of shadcn's border; scrolls inside on short windows */}
      <PopoverContent
        side="left"
        align="end"
        sideOffset={8}
        className="flex max-h-(--radix-popover-content-available-height) w-[330px] flex-col gap-4 overflow-y-auto rounded-3xl border-0 bg-card p-4 shadow-[0_0_0_1px_var(--border),0_10px_30px_rgb(0_0_0/0.28)]"
      >
        <StylePicker />
        <LayerSwitches fetchLife360={open} />
      </PopoverContent>
    </Popover>,
    control.container,
  );
}

/** One row of square thumbnails; the ring (2px card-coloured gap, 2px primary) slides to a new pick. */
function StylePicker() {
  const mapStyle = useSettingsStore((state) => state.mapStyle);
  const setMapStyle = useSettingsStore((state) => state.setMapStyle);
  const isDarkMode = useDarkMode();

  return (
    <section>
      <h3 className="mx-1 mb-2.5 text-[15px] font-bold">Kaartstijl</h3>
      <div role="radiogroup" aria-label="Kaartstijl" className="grid grid-cols-4 gap-2">
        {STYLES.map((style) => {
          const selected = mapStyle === style.value;
          return (
            <button
              key={style.value || 'auto'}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={style.name}
              onClick={() => setMapStyle(style.value as MapStyle)}
              className="group flex flex-col items-center gap-1.5 rounded-[14px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="relative block aspect-square w-full">
                <img
                  src={isDarkMode && style.darkThumb ? style.darkThumb : style.thumb}
                  alt=""
                  draggable={false}
                  className="size-full rounded-[14px] object-cover transition-transform duration-200 group-hover:scale-[1.05]"
                />
                {selected && (
                  <motion.span
                    layoutId="map-style-selected"
                    aria-hidden
                    className="pointer-events-none absolute -inset-1 rounded-[18px] border-2 border-primary"
                    transition={POP_SPRING}
                  />
                )}
              </span>
              <span className={cn('text-[11px] transition-colors', selected ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                {style.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Beheer rows (tonal blocks, 16/6 corners) with the M3 switch; the whole row toggles. */
function LayerSwitches({ fetchLife360 }: { fetchLife360: boolean }) {
  const toggles = useLayerToggles(fetchLife360);

  return (
    <section>
      <h3 className="mx-1 mb-2.5 text-[15px] font-bold">Lagen</h3>
      <BeheerRows>
        {toggles.map((layer) => (
          <RowFrame key={layer.id} className="hover:bg-beheer-row-high">
            <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-[13.5px] font-semibold">
              {layer.label}
              <BeheerSwitch checked={layer.checked} onCheckedChange={layer.toggle} />
            </label>
          </RowFrame>
        ))}
      </BeheerRows>
    </section>
  );
}
