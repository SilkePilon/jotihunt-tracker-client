# Map Layers Popover (option A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the map layers popover to the Beheer card look (spec `docs/superpowers/specs/2026-10-15-map-layers-popover-design.md`).

**Architecture:** Only `src/components/map/MapLayersControl.tsx` changes. The popover surface gets Beheer card classes; the style picker becomes a 5-column row of square thumbnails with a sliding ring; the layer list reuses `BeheerRows` + `RowFrame` from `src/components/beheer/BeheerLayout.tsx` and `BeheerSwitch` from `src/components/beheer/controls/BeheerSwitch.tsx`.

**Tech Stack:** React 19, Tailwind v4, radix-ui Popover, motion v14 (`motion/react`), react-map-gl/maplibre.

## Global Constraints

- Every state change animates (enter/exit/swap); motion respects reduced motion via the app's `MotionConfig`.
- Titles without icons, 15px bold. Dutch UI copy: "Kaartstijl", "Lagen", labels Auto, Straten, Outdoor, Satelliet, Donker; accessible name of Auto stays "Automatisch".
- Use site tokens only (`bg-card`, `bg-beheer-row`, `bg-beheer-row-high`, `--border`, `primary`), no hard-coded colours.

---

### Task 1: Beheer-style popover

**Files:**
- Modify: `src/components/map/MapLayersControl.tsx` (popover content, `StylePicker`, `LayerSwitches`, imports)

**Interfaces:**
- Consumes: `useLayerToggles(fetchLife360: boolean): LayerToggle[]` (`src/components/settings/layer-toggles.ts`), `BeheerRows({children, className})`, `RowFrame({tone, className, children})`, `BeheerSwitch` (radix Switch props).
- Produces: nothing new; default export `MapLayersControl({position})` unchanged.

- [x] **Step 1: Popover surface**

Replace the `PopoverContent` element and its children with:

```tsx
<PopoverContent
  side="left"
  align="end"
  sideOffset={8}
  className="flex max-h-(--radix-popover-content-available-height) w-[330px] flex-col gap-4 overflow-y-auto rounded-3xl border-0 bg-card p-4 shadow-[0_0_0_1px_var(--border),0_10px_30px_rgb(0_0_0/0.28)]"
>
  <StylePicker />
  <LayerSwitches fetchLife360={open} />
</PopoverContent>
```

- [x] **Step 2: Style picker**

`STYLES` gets a short `label` and full `name`:

```tsx
const STYLES: { value: MapStyle | ''; label: string; name: string; thumb: string; darkThumb?: string }[] = [
  { value: '', label: 'Auto', name: 'Automatisch', thumb: materialLightThumb, darkThumb: materialDarkThumb },
  { value: MapStyle.Streets, label: 'Straten', name: 'Straten', thumb: streetsThumb },
  { value: MapStyle.Outdoors, label: 'Outdoor', name: 'Outdoor', thumb: outdoorsThumb },
  { value: MapStyle.Satellite, label: 'Satelliet', name: 'Satelliet', thumb: satelliteThumb },
  { value: MapStyle.Dark, label: 'Donker', name: 'Donker', thumb: darkThumb },
];
```

`StylePicker` body:

```tsx
<section>
  <h3 className="mx-1 mb-2.5 text-[15px] font-bold">Kaartstijl</h3>
  <div role="radiogroup" aria-label="Kaartstijl" className="grid grid-cols-5 gap-1.5">
    {STYLES.map((style) => {
      const selected = mapStyle === style.value;
      return (
        <button key={style.value || 'auto'} type="button" role="radio" aria-checked={selected} aria-label={style.name}
                onClick={() => setMapStyle(style.value as MapStyle)}
                className="group flex flex-col items-center gap-1.5 rounded-[14px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <span className="relative block aspect-square w-full">
            <img src={isDarkMode && style.darkThumb ? style.darkThumb : style.thumb} alt="" draggable={false}
                 className="size-full rounded-[14px] object-cover transition-transform duration-200 group-hover:scale-[1.05]" />
            {selected && (
              <motion.span layoutId="map-style-selected" aria-hidden transition={POP_SPRING}
                           className="pointer-events-none absolute -inset-1 rounded-[18px] border-2 border-primary" />
            )}
          </span>
          <span className={cn('text-[11px] transition-colors', selected ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{style.label}</span>
        </button>
      );
    })}
  </div>
</section>
```

(`-inset-1` + 2px border leaves a 2px card-coloured gap between ring and thumbnail.)

- [x] **Step 3: Layer rows**

```tsx
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
```

Remove now-unused imports (`AnimatePresence`, `Switch`, `SWAP_TRANSITION`); add `BeheerRows, RowFrame` from `@/components/beheer/BeheerLayout` and `BeheerSwitch` from `@/components/beheer/controls/BeheerSwitch`.

- [x] **Step 4: Verify**

Run: `npx tsc -b` — expected: no output. Run: `npx --yes bun test src/components/tour` — expected: all pass.
Visual: temp harness page rendering `<Map/>` inside `AuthProvider` on a vite dev server (rAF polyfilled for the hidden preview tab), open the popover, screenshot light + dark; check ring gap, row radii 16/6, switches; delete harness after.

- [x] **Step 5: Commit**

```bash
git add src/components/map/MapLayersControl.tsx docs/superpowers/plans/2026-10-15-map-layers-popover.md
git commit -m "feat(map): Beheer-style layers popover (option A)"
```
