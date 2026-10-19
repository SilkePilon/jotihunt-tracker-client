import { motion } from 'motion/react';
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

/** '' = automatic: the Material map, light or dark with the theme. Thumbnails show Wageningen at z13. */
const STYLES: { value: MapStyle | ''; label: string; name: string; thumb: string; darkThumb?: string }[] = [
  { value: '', label: 'Auto', name: 'Automatisch', thumb: materialLightThumb, darkThumb: materialDarkThumb },
  { value: MapStyle.Streets, label: 'Straten', name: 'Straten', thumb: streetsThumb },
  { value: MapStyle.Outdoors, label: 'Outdoor', name: 'Outdoor', thumb: outdoorsThumb },
  { value: MapStyle.Satellite, label: 'Satelliet', name: 'Satelliet', thumb: satelliteThumb },
];

const GROUP_TITLE = 'mx-1 mt-3 mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase';

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

/** Four styles in one tonal track; the soft-orange pick slides to the chosen one. */
function StyleBar() {
  const mapStyle = useSettingsStore((state) => state.mapStyle);
  const setMapStyle = useSettingsStore((state) => state.setMapStyle);
  const isDarkMode = useDarkMode();
  return (
    <section>
      <h3 className="mx-1 mb-2 text-[15px] font-bold">Kaartstijl</h3>
      <div role="radiogroup" aria-label="Kaartstijl" className="grid grid-cols-4 gap-1 rounded-2xl bg-beheer-row p-1">
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
              className="group relative flex flex-col items-center gap-1 rounded-xl p-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {selected && <motion.span layoutId="map-style-pick" aria-hidden className="absolute inset-0 rounded-xl bg-primary-container" transition={POP_SPRING} />}
              <img
                src={isDarkMode && style.darkThumb ? style.darkThumb : style.thumb}
                alt=""
                draggable={false}
                className="relative aspect-[1.3] w-full rounded-[9px] object-cover transition-transform duration-200 group-hover:scale-[1.04]"
              />
              <span className={cn('relative text-[11px] transition-colors', selected ? 'font-semibold text-on-primary-container' : 'text-muted-foreground')}>{style.label}</span>
            </button>
          );
        })}
      </div>
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
                'h-6 w-7 rounded-[7px] text-xs font-semibold outline-none transition-colors duration-200 focus-visible:ring-[3px] focus-visible:ring-ring/50',
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
        'flex flex-col items-center gap-1.5 rounded-xl px-1 py-2 outline-none transition-colors duration-200 focus-visible:ring-[3px] focus-visible:ring-ring/50',
        toggle.checked ? 'bg-primary-container text-on-primary-container' : 'bg-beheer-row text-muted-foreground hover:bg-beheer-row-high',
      )}
    >
      <span
        className={cn('grid size-7 place-items-center rounded-[9px] border-2 border-white shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-[filter,opacity] duration-200', !toggle.checked && 'opacity-45 grayscale')}
        style={{ background: BRAND_COLOR[toggle.brand] }}
      >
        <img src={BRAND_LOGO_URL[toggle.brand]} alt="" width={FASTFOOD_LOGO_WIDTH[toggle.brand] - 2} draggable={false} />
      </span>
      <span className="text-[11px] font-semibold">{toggle.label}</span>
    </button>
  );
}
