import { motion } from 'motion/react';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import materialLightThumb from '@/assets/map-styles/material-light.webp';
import materialDarkThumb from '@/assets/map-styles/material-dark.webp';
import streetsThumb from '@/assets/map-styles/streets.webp';
import outdoorsThumb from '@/assets/map-styles/outdoors.webp';
import satelliteThumb from '@/assets/map-styles/satellite.webp';
import { BeheerRows, RowFrame } from '@/components/beheer/BeheerLayout';
import BeheerSwitch from '@/components/beheer/controls/BeheerSwitch';
import { BRAND_LOGO_URL, FASTFOOD_LOGO_WIDTH } from '@/components/layers/brand-logos';
import { useLayerGroups, type FoodToggle, type LayerRow } from '@/components/settings/layer-toggles';
import { useDarkMode } from '@/hooks/utils/darkmode.hook';
import { BRAND_COLOR } from '@/lib/fastfood';
import { POP_SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';
import useSettingsStore from '@/stores/settings.store';
import { MapStyle } from '@/types/MapStyle';

/**
 * '' = automatic: the Material map, light or dark with the theme. Thumbnails show Wageningen at z13. `name` (when set)
 * is the accessible name; it starts with the visible label, so voice control can still say "Auto".
 */
const STYLES: { value: MapStyle | ''; label: string; name?: string; thumb: string; darkThumb?: string }[] = [
  { value: '', label: 'Auto', name: 'Auto, licht of donker met het thema', thumb: materialLightThumb, darkThumb: materialDarkThumb },
  { value: MapStyle.Streets, label: 'Straten', thumb: streetsThumb },
  { value: MapStyle.Outdoors, label: 'Outdoor', thumb: outdoorsThumb },
  { value: MapStyle.Satellite, label: 'Satelliet', thumb: satelliteThumb },
];

/** Radix radio values can't be empty: the automatic style's '' goes through this one */
const AUTO_VALUE = 'auto';

const GROUP_TITLE = 'mx-1 mt-3 mb-1.5 text-xs desk:text-[11px] font-semibold tracking-wide text-muted-foreground uppercase';

/** Map style bar + grouped layer rows + fastfood brands (option A); used in the desktop popover and the phone drawer. */
export default function MapLayersPanel({ fetchLife360 }: { fetchLife360: boolean }) {
  const { groups, food } = useLayerGroups(fetchLife360);
  return (
    <div className="flex flex-col">
      <StyleBar />
      {groups.map((group) => (
        <section key={group.id}>
          <h3 className={GROUP_TITLE}>{group.title}</h3>
          <BeheerRows>
            {group.rows.map((row) => (
              <LayerRowView key={row.id} row={row} />
            ))}
          </BeheerRows>
        </section>
      ))}
      <section>
        <h3 className={GROUP_TITLE}>{food.title}</h3>
        <div className="grid grid-cols-3 gap-1">
          {food.toggles.map((toggle) => (
            <FoodButton key={toggle.brand} toggle={toggle} />
          ))}
        </div>
      </section>
    </div>
  );
}

/** Four styles in one tonal track; the soft-orange pick slides to the chosen one. A radio group: one Tab stop, arrow keys choose. */
function StyleBar() {
  const mapStyle = useSettingsStore((state) => state.mapStyle);
  const setMapStyle = useSettingsStore((state) => state.setMapStyle);
  const isDarkMode = useDarkMode();
  return (
    <section>
      <h3 className="mx-1 mb-2 text-[15px] font-bold">Kaartstijl</h3>
      <RadioGroupPrimitive.Root
        aria-label="Kaartstijl"
        value={mapStyle || AUTO_VALUE}
        onValueChange={(value) => setMapStyle((value === AUTO_VALUE ? '' : value) as MapStyle)}
        className="grid grid-cols-4 gap-1 rounded-2xl bg-beheer-row p-1"
      >
        {STYLES.map((style) => {
          const selected = mapStyle === style.value;
          return (
            <RadioGroupPrimitive.Item
              key={style.value || AUTO_VALUE}
              value={style.value || AUTO_VALUE}
              aria-label={style.name}
              className="group relative flex flex-col items-center gap-1 rounded-xl p-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
            >
              {selected && <motion.span layoutId="map-style-pick" aria-hidden className="absolute inset-0 rounded-xl bg-primary-container" transition={POP_SPRING} />}
              <img
                src={isDarkMode && style.darkThumb ? style.darkThumb : style.thumb}
                alt=""
                draggable={false}
                className="relative aspect-[1.3] w-full rounded-[9px] object-cover transition-transform duration-200 group-hover:scale-[1.04]"
              />
              <span className={cn('relative text-xs transition-colors desk:text-[11px]', selected ? 'font-semibold text-on-primary-container' : 'text-muted-foreground')}>{style.label}</span>
            </RadioGroupPrimitive.Item>
          );
        })}
      </RadioGroupPrimitive.Root>
    </section>
  );
}

/** A switch row (whole row toggles) or the markers row with its 1 / 2 buttons. */
function LayerRowView({ row }: { row: LayerRow }) {
  const Icon = row.icon;
  if (row.kind === 'switch') {
    return (
      <RowFrame className="hover:bg-beheer-row-high">
        <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="flex-1 text-[13px] font-semibold">{row.label}</span>
          <BeheerSwitch checked={row.checked} onCheckedChange={row.toggle} />
        </label>
      </RowFrame>
    );
  }
  return (
    <RowFrame>
      <div className="flex items-center gap-2.5 px-3 py-2">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex-1 text-[13px] font-semibold">{row.label}</span>
        <div className="flex gap-0.5 rounded-[9px] bg-card p-0.5">
          {row.parts.map((part) => (
            <button
              key={part.id}
              type="button"
              aria-pressed={part.checked}
              aria-label={part.ariaLabel}
              onClick={part.toggle}
              className={cn(
                'h-6 w-7 rounded-[7px] text-xs font-semibold outline-none transition-colors duration-200 focus-visible:ring-[3px] focus-visible:ring-ring',
                // Phones: 44×32 halves, and the invisible ::after reaches into the row's padding for a 44px tall touch area
                // (side by side they can't grow sideways without overlapping); desktop keeps the compact 28×24
                'relative pointer-coarse:h-8 pointer-coarse:w-11 pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.5 pointer-coarse:after:content-[\'\']',
                part.checked ? 'bg-primary-container text-on-primary-container' : 'text-muted-foreground hover:bg-beheer-row-high',
              )}
            >
              {part.label}
            </button>
          ))}
        </div>
      </div>
    </RowFrame>
  );
}

/** A brand tile (same look as its map marker) over the name; greyed out while off. */
function FoodButton({ toggle }: { toggle: FoodToggle }) {
  return (
    <button
      type="button"
      aria-pressed={toggle.checked}
      onClick={toggle.toggle}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-xl px-1 py-2 outline-none transition-colors duration-200 focus-visible:ring-[3px] focus-visible:ring-ring',
        toggle.checked ? 'bg-primary-container text-on-primary-container' : 'bg-beheer-row text-muted-foreground hover:bg-beheer-row-high',
      )}
    >
      <span
        className={cn('grid size-7 place-items-center rounded-[9px] border-2 border-white shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-[filter,opacity] duration-200', !toggle.checked && 'opacity-45 grayscale')}
        style={{ background: BRAND_COLOR[toggle.brand] }}
      >
        {/* 2px smaller than on the 28px marker: the white rim sits inside this tile's box */}
        <img src={BRAND_LOGO_URL[toggle.brand]} alt="" width={FASTFOOD_LOGO_WIDTH[toggle.brand] - 2} draggable={false} />
      </span>
      <span className="text-xs font-semibold desk:text-[11px]">{toggle.label}</span>
    </button>
  );
}
