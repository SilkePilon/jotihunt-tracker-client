# Map layers popover: option A (Beheer card)

Date: 2026-10-15. Branch `feat/map-layers-button` (first version af80dd5).

## Problem

The map layers button (desktop, top of the bottom-right control stack) opens a popover built from stock shadcn parts
(thin border, 12px corners, small switches, 4:3 thumbnails). It does not match the site's newer look: the sidebar
cards, Beheer window and map popups.

## Decision

The user picked mockup **A, Beheer card** (visual companion, `.superpowers/brainstorm/44659-1792095352/content/layers-popover.html`).

## Design

Popover (`MapLayersControl`, unchanged position: left of the button, bottom-aligned, 8px gap):

- **Surface**: `bg-card`, `rounded-3xl`, `p-4`, width 330px; shadow `0 0 0 1px var(--border), 0 10px 30px rgb(0 0 0 / .28)`
  instead of shadcn's border. No stock shadcn padding/border. Enter/exit keep the existing Radix fade + zoom.
  When the window is short, the body scrolls inside (`max-h` = Radix available height) with the site's thin scrollbar.
- **Titles**: "Kaartstijl" and "Lagen", 15px bold, no icons (like `BeheerCard` titles), 10px above their content.
- **Map styles**: one row of 5 square thumbnails (`grid-cols-5`, gap 6px, `rounded-[14px]`, `object-cover` of the existing
  webp thumbnails; Automatisch shows the light or dark Material thumb with the theme). Labels under them, 11px muted:
  Auto, Straten, Outdoor, Satelliet, Donker. Selected: a 2px primary ring with a 2px card-coloured gap around the
  thumbnail that slides to a new pick (`layoutId`, `POP_SPRING`), label turns foreground + semibold. Hover: thumbnail
  scales slightly. `role="radiogroup"` / `role="radio"`, the full name "Automatisch" stays the accessible label.
- **Layers**: Beheer's `BeheerRows` + `BeheerRow` (tonal blocks 2px apart, outer corners 16px, inner 6px, 13.5px
  semibold title) with the Material 3 `BeheerSwitch` as trailing control. The whole row toggles the layer
  (`<label>` around the row content). Rows that appear/disappear (Voorspelling, Life360) fold in/out via `RowFrame`.
  Same layer list as now (`useLayerToggles`), 16px gap between the styles block and "Lagen".

Unchanged: the button itself, maxBounds, Settings submenus on phones only, tour step, `useLayerToggles`.

## Testing

`tsc -b`, tour tests; visual check of light and dark in a harness page with the real `Map` (as for af80dd5).

## Follow-up (2026-10-15)

The Donker style is removed everywhere (the automatic Material map already follows the theme): 4 thumbnails
(`grid-cols-4`), `MapStyle.Dark` gone, settings store v2 migrates a persisted `'dark'` to automatic.
