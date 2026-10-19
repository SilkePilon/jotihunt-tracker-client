# Map layers panel redesign + uniform close buttons — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat map style/layers popover with the grouped panel (option A), show the same panel in a phone drawer, and give every dialog and map popup the Account dialog's close button.

**Architecture:** A pure `layerGroups()` builds the grouped rows from the layers store; `useLayerGroups()` wraps it; `MapLayersPanel` renders it and is used by the desktop popover (`MapLayersControl`) and a new `LayersDialog` (ResponsiveDialog → drawer on phones) opened from the settings menu. Close buttons: the base `ui/dialog.tsx` close gets the DIALOG_SHELL look, a shared `CloseButton` is used by map popups (MapLibre's own button off) and the docked popup.

**Tech Stack:** React 19, Tailwind 4, Radix (dialog, switch), vaul, motion/react, zustand, lucide-react, bun:test.

Spec: `docs/superpowers/specs/2026-10-19-layers-panel-redesign-design.md`. Mockup: workspace `.superpowers/brainstorm/98339-1792416537/content/layers-layout.html`, option A.

## Global Constraints

- Close button look everywhere: 34×32 px, 12px corners (`rounded-xl`), `bg-beheer-row`, hover `bg-beheer-row-high`, `text-muted-foreground`, lucide `XIcon` 16px, `transition-colors`, focus ring `focus-visible:ring-[3px] focus-visible:ring-ring/50`; in dialogs 16px from top/right (`top-4 right-4`), in map popups 12px (`top-3 right-3`).
- Panel style bar: `bg-beheer-row` track, 16px corners, 4px padding, 4 columns, 4px gaps; option 12px corners, thumbnail aspect 1.3 with 9px corners, label 11px; selected `bg-primary-container text-on-primary-container` + semibold, sliding `motion.span` with `layoutId` and `POP_SPRING`.
- Group headings 11px uppercase muted semibold, 12px top margin; rows Beheer-grouped (`BeheerRows` / `RowFrame`), icon 16px muted, label 13px semibold.
- Row labels (exact): Groepen, Groepscirkels, Tegenhunt-cirkel, Markers, Voorspelling, Auto's, Life360, 3D-gebouwen; group titles: Spel, Team & kaart, Eten; marker part labels "1"/"2" with aria-labels "Speelhelft 1"/"Speelhelft 2".
- Voorspelling only while predictions are on (`usePredictionSetting().enabled !== false`); Life360 only with a linked account.
- Fastfood tiles: 28px brand tile (brand colour, 2px white rim, logo width from `FASTFOOD_LOGO_WIDTH`), off = greyscale + 45% opacity, on = tile `bg-primary-container`, name `text-on-primary-container`; 200ms transitions.
- Phone: settings menu item "Kaart & lagen" (`LayersIcon`) opens the drawer titled "Kaart & lagen", description "Kaartstijl en zichtbare lagen."; `MapStyleSubmenu.tsx` and `LayersSubmenu.tsx` are deleted.
- Every UI state change animates (user rule).
- Commands: `npx --yes bun test`, `npx --yes tsc -b`, `npx --yes eslint <paths>`, `npx --yes vite build`. Work in worktree `.worktrees/client-layers` on branch `feat/layers-panel`.

---

### Task 1: Uniform close buttons

**Files:**
- Create: `src/components/ui/close-button.tsx`
- Modify: `src/components/ui/dialog.tsx` (built-in close)
- Modify: `src/components/map/MapPopup.tsx`, `src/components/mobile/DockedPopup.tsx`, `src/index.css`
- Modify: `src/components/account/RenamePasskeyDialog.tsx`, `src/components/map/MarkerRegistration.tsx`, `src/components/tracker/TrackerGuideDialog.tsx`, `src/components/DebugInfo.tsx`
- Modify: `src/components/ImageLightbox.tsx`

**Interfaces:**
- Produces: `CLOSE_BUTTON_CLASS: string`, `CloseButton({ onClick, className, label? }: { onClick: () => void; className?: string; label?: string })` (default label "Sluiten").

- [ ] **Step 1: `close-button.tsx`**

```tsx
import { XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The Account dialog's close button: 34×32, 12px corners, tonal; position it with `className`. */
export const CLOSE_BUTTON_CLASS =
  'grid h-8 w-[34px] shrink-0 cursor-pointer place-items-center rounded-xl bg-beheer-row text-muted-foreground outline-none transition-colors hover:bg-beheer-row-high focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4';

export function CloseButton({ onClick, className, label = 'Sluiten' }: { onClick: () => void; className?: string; label?: string }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={cn(CLOSE_BUTTON_CLASS, className)}>
      <XIcon />
    </button>
  );
}
```

- [ ] **Step 2: Base dialog close** — in `src/components/ui/dialog.tsx`, `DialogContent`'s `DialogPrimitive.Close` (the one rendered when `showCloseButton`): replace its className with `cn(CLOSE_BUTTON_CLASS, 'absolute top-4 right-4')` (import `CLOSE_BUTTON_CLASS` from `./close-button`) and change the sr-only text to "Sluiten". Leave `DIALOG_SHELL` as is (its close overrides become no-ops but harmless; don't touch it).

- [ ] **Step 3: Map popup close** — `MapPopup.tsx`: pass `closeButton={false}` to the MapLibre `Popup` and render, as the first child inside the `w-[220px]` wrapper's parent, `<CloseButton onClick={onClose} className="absolute top-3 right-3 z-10" />` (`.maplibregl-popup-content` is `position: relative`, so absolute positions against the card). `DockedPopup.tsx`: replace its hand-made close `<button>` with `<CloseButton onClick={requestClose} className="absolute top-3 right-3" />` (drop the now unused `XIcon` import if any). In `src/index.css` delete the `.maplibregl-popup-close-button` and `.maplibregl-popup-close-button:hover` rules.

- [ ] **Step 4: Dialogs on the shell** — add `DIALOG_SHELL` (from `@/lib/dialog-shell`) and `bg-card` to the `DialogContent` className in:
  - `RenamePasskeyDialog.tsx`: `className={cn(DIALOG_SHELL, 'bg-card sm:max-w-sm')}`
  - `MarkerRegistration.tsx`: `className={cn(DIALOG_SHELL, 'bg-card')}`
  - `TrackerGuideDialog.tsx`: `className={cn(DIALOG_SHELL, 'max-h-[90dvh] overflow-y-auto bg-card sm:max-w-md')}` (keep `data-tracker-guide`)
  - `DebugInfo.tsx`: `className={cn(DIALOG_SHELL, 'bg-card')}`
  Import `cn` where missing.

- [ ] **Step 5: Lightbox** — `ImageLightbox.tsx`: the four buttons in the top-right toolbar (zoom out, zoom in, reset, close) become one look so the close matches the shape: replace each `<Button variant="secondary" size="icon" …>` with a plain `<button type="button" …>` using `cn(CLOSE_BUTTON_CLASS, 'bg-black/50 text-white backdrop-blur hover:bg-black/65 disabled:opacity-40 disabled:pointer-events-none')`, keeping their aria-labels, onClick and disabled props. Remove the `Button` import if unused.

- [ ] **Step 6: Checks** — `npx --yes tsc -b && npx --yes eslint src/components && npx --yes bun test` → clean / all pass. `grep -rn "maplibregl-popup-close-button" src` → no output.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/close-button.tsx src/components/ui/dialog.tsx src/components/map/MapPopup.tsx src/components/mobile/DockedPopup.tsx src/index.css src/components/account/RenamePasskeyDialog.tsx src/components/map/MarkerRegistration.tsx src/components/tracker/TrackerGuideDialog.tsx src/components/DebugInfo.tsx src/components/ImageLightbox.tsx
git commit -m "feat(dialogs): one close button everywhere, like the Account dialog"
```

---

### Task 2: Grouped layer data

**Files:**
- Modify: `src/components/settings/layer-toggles.ts` (replace `useLayerToggles`)
- Test: `src/components/settings/layer-toggles.test.ts`

**Interfaces:**
- Consumes: `useLayersStore` state, `usePredictionSetting`, `useLife360Members`, `BRANDS`, `BRAND_LABEL`, `type Brand` from `@/lib/fastfood`.
- Produces:

```ts
export interface SwitchRow { kind: 'switch'; id: string; label: string; icon: LucideIcon; checked: boolean; toggle: () => void }
export interface MarkersRow { kind: 'markers'; id: 'markers'; label: string; icon: LucideIcon; parts: { id: 'markers1' | 'markers2'; label: string; ariaLabel: string; checked: boolean; toggle: () => void }[] }
export type LayerRow = SwitchRow | MarkersRow;
export interface LayerGroup { id: 'game' | 'team'; title: string; rows: LayerRow[] }
export interface FoodToggle { brand: Brand; label: string; checked: boolean; toggle: () => void }
export interface LayerGroups { groups: LayerGroup[]; food: { title: string; toggles: FoodToggle[] } }
export type LayerFlags = Pick<LayersState, …all show*/toggle* fields…>;
export function layerGroups(layers: LayerFlags, options: { predictions: boolean; life360: boolean }): LayerGroups;
export function useLayerGroups(fetchLife360: boolean): LayerGroups;
```

(`LayersState` must be exported from `src/stores/layers.store.ts` — add `export` to its interface.)

- [ ] **Step 1: Failing tests** — `src/components/settings/layer-toggles.test.ts`:

```ts
import { describe, expect, mock, test } from 'bun:test';
import { layerGroups, type LayerFlags } from './layer-toggles';

function flags(overrides: Partial<LayerFlags> = {}): LayerFlags {
  const noop = mock(() => {});
  return {
    showTeams: true, showDevices: true, showMarkersPart1: false, showMarkersPart2: true, showHomeCircle: true,
    showGroupCircles: false, showPredictions: true, showLife360: true, showBuildings3d: true,
    showMcDonalds: false, showKfc: true, showBurgerKing: false,
    toggleTeams: noop, toggleDevices: noop, toggleMarkersPart1: noop, toggleMarkersPart2: noop, toggleHomeCircle: noop,
    toggleGroupCircles: noop, togglePredictions: noop, toggleLife360: noop, toggleBuildings3d: noop,
    toggleMcDonalds: noop, toggleKfc: noop, toggleBurgerKing: noop,
    ...overrides,
  };
}

const labels = (result: ReturnType<typeof layerGroups>) => result.groups.map((group) => [group.title, group.rows.map((row) => row.label)]);

describe('layerGroups', () => {
  test('groups, order and labels', () => {
    expect(labels(layerGroups(flags(), { predictions: true, life360: true }))).toEqual([
      ['Spel', ['Groepen', 'Groepscirkels', 'Tegenhunt-cirkel', 'Markers', 'Voorspelling']],
      ['Team & kaart', ["Auto's", 'Life360', '3D-gebouwen']],
    ]);
  });
  test('Voorspelling only with predictions, Life360 only when linked', () => {
    expect(labels(layerGroups(flags(), { predictions: false, life360: false }))).toEqual([
      ['Spel', ['Groepen', 'Groepscirkels', 'Tegenhunt-cirkel', 'Markers']],
      ['Team & kaart', ["Auto's", '3D-gebouwen']],
    ]);
  });
  test('markers row carries both parts with their own state and toggle', () => {
    const toggleMarkersPart1 = mock(() => {});
    const row = layerGroups(flags({ toggleMarkersPart1 }), { predictions: true, life360: true }).groups[0].rows[3];
    expect(row.kind).toBe('markers');
    if (row.kind !== 'markers') return;
    expect(row.parts.map((part) => [part.label, part.ariaLabel, part.checked])).toEqual([
      ['1', 'Speelhelft 1', false],
      ['2', 'Speelhelft 2', true],
    ]);
    row.parts[0].toggle();
    expect(toggleMarkersPart1).toHaveBeenCalledTimes(1);
  });
  test('switch rows reflect the store', () => {
    const rows = layerGroups(flags(), { predictions: true, life360: true }).groups[0].rows;
    expect(rows.filter((row) => row.kind === 'switch').map((row) => (row.kind === 'switch' ? row.checked : null))).toEqual([true, false, true, true]);
  });
  test('food toggles in brand order', () => {
    const { food } = layerGroups(flags(), { predictions: true, life360: true });
    expect(food.title).toBe('Eten');
    expect(food.toggles.map((toggle) => [toggle.brand, toggle.label, toggle.checked])).toEqual([
      ['mcdonalds', "McDonald's", false],
      ['kfc', 'KFC', true],
      ['burgerking', 'Burger King', false],
    ]);
  });
});
```

Run: `npx --yes bun test src/components/settings/layer-toggles.test.ts` → FAIL (`layerGroups` not exported).

- [ ] **Step 2: Implement** — replace `src/components/settings/layer-toggles.ts` with:

```ts
import { Building2Icon, CarIcon, CircleDashedIcon, MapPinIcon, SparklesIcon, TargetIcon, UserRoundIcon, UsersIcon, type LucideIcon } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import useLayersStore, { type LayersState } from '@/stores/layers.store';
import { useLife360Members } from '@/hooks/life360.hook';
import { usePredictionSetting } from '@/hooks/predictions.hook';
import { BRAND_LABEL, BRANDS, type Brand } from '@/lib/fastfood';

export interface SwitchRow {
  kind: 'switch';
  id: string;
  label: string;
  icon: LucideIcon;
  checked: boolean;
  toggle: () => void;
}

export interface MarkersRow {
  kind: 'markers';
  id: 'markers';
  label: string;
  icon: LucideIcon;
  parts: { id: 'markers1' | 'markers2'; label: string; ariaLabel: string; checked: boolean; toggle: () => void }[];
}

export type LayerRow = SwitchRow | MarkersRow;

export interface LayerGroup {
  id: 'game' | 'team';
  title: string;
  rows: LayerRow[];
}

export interface FoodToggle {
  brand: Brand;
  label: string;
  checked: boolean;
  toggle: () => void;
}

export interface LayerGroups {
  groups: LayerGroup[];
  food: { title: string; toggles: FoodToggle[] };
}

/** The layers store without its persist plumbing: every show flag and its toggle. */
export type LayerFlags = Omit<LayersState, never>;

const sw = (id: string, label: string, icon: LucideIcon, checked: boolean, toggle: () => void): SwitchRow => ({ kind: 'switch', id, label, icon, checked, toggle });

/**
 * The map layers for the layers panel, grouped (Spel, Team & kaart) plus the fastfood brands (Eten). Voorspelling only
 * while predictions are on, Life360 only with a linked account.
 */
export function layerGroups(layers: LayerFlags, options: { predictions: boolean; life360: boolean }): LayerGroups {
  const game: LayerRow[] = [
    sw('teams', 'Groepen', UsersIcon, layers.showTeams, layers.toggleTeams),
    sw('groupCircles', 'Groepscirkels', CircleDashedIcon, layers.showGroupCircles, layers.toggleGroupCircles),
    sw('homeCircle', 'Tegenhunt-cirkel', TargetIcon, layers.showHomeCircle, layers.toggleHomeCircle),
    {
      kind: 'markers',
      id: 'markers',
      label: 'Markers',
      icon: MapPinIcon,
      parts: [
        { id: 'markers1', label: '1', ariaLabel: 'Speelhelft 1', checked: layers.showMarkersPart1, toggle: layers.toggleMarkersPart1 },
        { id: 'markers2', label: '2', ariaLabel: 'Speelhelft 2', checked: layers.showMarkersPart2, toggle: layers.toggleMarkersPart2 },
      ],
    },
  ];
  if (options.predictions) game.push(sw('predictions', 'Voorspelling', SparklesIcon, layers.showPredictions, layers.togglePredictions));

  const team: LayerRow[] = [sw('devices', "Auto's", CarIcon, layers.showDevices, layers.toggleDevices)];
  if (options.life360) team.push(sw('life360', 'Life360', UserRoundIcon, layers.showLife360, layers.toggleLife360));
  team.push(sw('buildings3d', '3D-gebouwen', Building2Icon, layers.showBuildings3d, layers.toggleBuildings3d));

  const shown: Record<Brand, [boolean, () => void]> = {
    mcdonalds: [layers.showMcDonalds, layers.toggleMcDonalds],
    kfc: [layers.showKfc, layers.toggleKfc],
    burgerking: [layers.showBurgerKing, layers.toggleBurgerKing],
  };

  return {
    groups: [
      { id: 'game', title: 'Spel', rows: game },
      { id: 'team', title: 'Team & kaart', rows: team },
    ],
    food: { title: 'Eten', toggles: BRANDS.map((brand) => ({ brand, label: BRAND_LABEL[brand], checked: shown[brand][0], toggle: shown[brand][1] })) },
  };
}

/**
 * The grouped layers for the panel.
 * @param fetchLife360 Fetch the Life360 members (while the panel is open), so the row also appears when the layer is off
 */
export function useLayerGroups(fetchLife360: boolean): LayerGroups {
  const layers = useLayersStore(useShallow((state) => state));
  const { enabled: predictionEnabled } = usePredictionSetting();
  const { data: life360 } = useLife360Members(fetchLife360);
  return layerGroups(layers, { predictions: predictionEnabled !== false, life360: !!life360?.linked });
}
```

In `src/stores/layers.store.ts` change `interface LayersState` to `export interface LayersState`.

Note: `useShallow((state) => state)` re-renders only when a field changes; the store has no other fields.

- [ ] **Step 3: Tests pass** — `npx --yes bun test src/components/settings/layer-toggles.test.ts` → PASS. `npx --yes tsc -b` will now FAIL in `MapLayersControl.tsx` and `LayersSubmenu.tsx` (they import `useLayerToggles`). Keep a temporary compatibility export so this task compiles on its own — append to `layer-toggles.ts`:

```ts
/** @deprecated Flat list for the old popover and submenu; removed with them in the next tasks. */
export interface LayerToggle {
  id: string;
  label: string;
  checked: boolean;
  toggle: () => void;
}

/** @deprecated See LayerToggle. */
export function useLayerToggles(fetchLife360: boolean): LayerToggle[] {
  const { groups, food } = useLayerGroups(fetchLife360);
  return [
    ...groups.flatMap((group) => group.rows.flatMap((row) => (row.kind === 'switch' ? [row] : row.parts.map((part) => ({ id: part.id, label: `Markers (speelhelft ${part.label})`, checked: part.checked, toggle: part.toggle }))))),
    ...food.toggles.map((toggle) => ({ id: toggle.brand, label: toggle.label, checked: toggle.checked, toggle: toggle.toggle })),
  ];
}
```

Run `npx --yes tsc -b && npx --yes eslint src/components/settings src/stores && npx --yes bun test` → clean / PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/layer-toggles.ts src/components/settings/layer-toggles.test.ts src/stores/layers.store.ts
git commit -m "feat(layers): grouped layer rows for the new layers panel"
```

---

### Task 3: `MapLayersPanel` + desktop popover

**Files:**
- Create: `src/components/map/layers/MapLayersPanel.tsx`
- Modify: `src/components/map/MapLayersControl.tsx`

**Interfaces:**
- Consumes: `useLayerGroups` (Task 2), `BeheerRows`, `RowFrame` (`@/components/beheer/BeheerLayout`), `BeheerSwitch`, `BRAND_COLOR` (`@/lib/fastfood`), `BRAND_LOGO_URL`, `FASTFOOD_LOGO_WIDTH` (`@/components/layers/brand-logos`), `useSettingsStore` (`mapStyle`, `setMapStyle`), `useDarkMode`, `POP_SPRING`.
- Produces: `MapLayersPanel({ fetchLife360 }: { fetchLife360: boolean })` (default export).

- [ ] **Step 1: Move the style list** — move the `STYLES` constant and the thumbnail imports from `MapLayersControl.tsx` into `MapLayersPanel.tsx` (unchanged values).

- [ ] **Step 2: Write `MapLayersPanel.tsx`**

```tsx
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
```

- [ ] **Step 3: Popover uses the panel** — in `MapLayersControl.tsx`: remove `StylePicker`, `LayerSwitches`, `STYLES`, the thumbnail imports and now-unused imports (`motion`, `useSettingsStore`, `useDarkMode`, `useLayerToggles`, `MapStyle`, `POP_SPRING`, `cn`, `BeheerRows`, `RowFrame`, `BeheerSwitch`); the `PopoverContent` children become `<MapLayersPanel fetchLife360={open} />`; change its className gap (`gap-4` → nothing needed, keep `flex flex-col`) and width stays `w-[330px]`. Update the doc comment: "Map button (desktop) that opens the map style and layers panel."

- [ ] **Step 4: Checks + commit** — `npx --yes tsc -b && npx --yes eslint src/components/map && npx --yes bun test` → clean / PASS.

```bash
git add src/components/map/layers/MapLayersPanel.tsx src/components/map/MapLayersControl.tsx
git commit -m "feat(layers): grouped map style and layers panel in the map popover"
```

---

### Task 4: Phone drawer from the settings menu

**Files:**
- Create: `src/stores/layers-dialog.store.ts`
- Create: `src/components/map/layers/LayersDialog.tsx`
- Modify: `src/Layout.tsx` (mount `<LayersDialog/>` next to `<AccountDialog/>`)
- Modify: `src/components/Settings.tsx`
- Delete: `src/components/settings/LayersSubmenu.tsx`, `src/components/settings/MapStyleSubmenu.tsx`
- Modify: `src/components/settings/layer-toggles.ts` (remove the deprecated `useLayerToggles`/`LayerToggle`)

**Interfaces:**
- Consumes: `MapLayersPanel` (Task 3), `ResponsiveDialog`, `DIALOG_SHELL`.
- Produces: `useLayersDialogStore` (`open`, `setOpen`).

- [ ] **Step 1: Store** — `src/stores/layers-dialog.store.ts`:

```ts
import { create } from 'zustand';

interface LayersDialogState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

/** The "Kaart & lagen" drawer (phones), opened from the gear menu. */
const useLayersDialogStore = create<LayersDialogState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

export default useLayersDialogStore;
```

- [ ] **Step 2: Dialog** — `src/components/map/layers/LayersDialog.tsx`:

```tsx
import ResponsiveDialog from '@/components/ResponsiveDialog';
import { DIALOG_SHELL } from '@/lib/dialog-shell';
import { cn } from '@/lib/utils';
import useLayersDialogStore from '@/stores/layers-dialog.store';
import MapLayersPanel from './MapLayersPanel';

/** Phones: the map style and layers panel in a drawer (desktop uses the map button's popover). */
export default function LayersDialog() {
  const open = useLayersDialogStore((state) => state.open);
  const setOpen = useLayersDialogStore((state) => state.setOpen);
  return (
    <ResponsiveDialog
      open={open}
      onClose={() => setOpen(false)}
      title="Kaart & lagen"
      description="Kaartstijl en zichtbare lagen."
      className={cn(DIALOG_SHELL, 'bg-card p-5 sm:max-w-sm')}
      drawerClassName="bg-card"
      compact
    >
      <div className="min-h-0 overflow-y-auto pb-1">
        <MapLayersPanel fetchLife360={open} />
      </div>
    </ResponsiveDialog>
  );
}
```

Mount `<LayersDialog/>` in `src/Layout.tsx` right after `<AccountDialog/>` (add the import).

- [ ] **Step 3: Settings menu** — in `src/components/Settings.tsx`: remove the `LayersSubmenu` / `MapStyleSubmenu` imports; replace the `{isMobile && (<><LayersSubmenu/><MapStyleSubmenu/></>)}` block with:

```tsx
                        {/* Desktop has the layers button on the map; phones get the same panel in a drawer */}
                        {isMobile && (
                            <MenuRow onClick={() => {
                                setMenuOpen(false);
                                openLayers(true);
                            }}>
                                <LayersIcon/>
                                Kaart &amp; lagen
                            </MenuRow>
                        )}
```

with `const openLayers = useLayersDialogStore((state) => state.setOpen);` next to the other store hooks, and `LayersIcon` added to the lucide import (match the file's existing import style: 4-space indent, no spaces in braces).

- [ ] **Step 4: Remove the old pieces** — delete `LayersSubmenu.tsx` and `MapStyleSubmenu.tsx`; remove the deprecated `LayerToggle` / `useLayerToggles` from `layer-toggles.ts`. Run `grep -rn "useLayerToggles\|LayersSubmenu\|MapStyleSubmenu" src` → no output. If `menu-parts.tsx` exports (`MenuSubRow`, `SUBMENU_SIDE_OFFSET`) are now unused, leave them only if something else uses them (`grep`); otherwise remove those exports.

- [ ] **Step 5: Checks + commit** — `npx --yes tsc -b && npx --yes eslint src && npx --yes bun test && npx --yes vite build` → clean / PASS / build ok.

```bash
git add -A src
git commit -m "feat(layers): phones open the same panel in a drawer from the gear menu"
```

---

### Task 5: Browser check (controller)

Run the server (any branch, throwaway DB, as in the fastfood E2E) and the client dev server; in light + dark, desktop + 390px:
popover and drawer panel (style slide, switches, 1/2 buttons, logo buttons each toggle their layer on the map), the
menu item, and close buttons on a map popup, the docked popup, Account, Meldingen, Marker registration, Debug, the
lightbox. Fix issues in the task they belong to.
