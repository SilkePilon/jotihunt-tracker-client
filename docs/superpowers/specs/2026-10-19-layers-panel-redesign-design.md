# Map layers panel redesign + uniform close buttons — design

Date: 2026-10-19 · Repo: client only · Mockup: `.superpowers/brainstorm/98339-1792416537/content/layers-layout.html`
(option **A**) in the workspace root.

## Goal

The map style / layers popover grew to 12 flat switch rows with a thumbnail row the user doesn't like. Make it calm
and grouped (option A), use the same panel on phones, and give every dialog and map popup the Account dialog's close
button.

## User decisions

- Layout **A · Gegroepeerde lijst**: compact style bar, grouped rows with icons, markers 1/2 in one row, fastfood as
  three logo buttons.
- Phones: the same panel in a bottom drawer, opened from one "Kaart & lagen" item in the settings menu; the
  "Kaartstijl" and "Lagen" submenus go.
- Markers: two independent buttons **1** and **2** (both, one or none on).
- Close buttons: all like the Account dialog's (DIALOG_SHELL).

## Panel — `components/map/layers/MapLayersPanel.tsx`

One component, no own shell; rendered inside the desktop popover and the phone drawer.

### Style bar

- Heading "Kaartstijl" (15px bold, like now).
- A `bg-beheer-row` container, 16px corners, 4px padding, 4 equal columns with 4px gaps.
- Each option: 12px-corner button with a map thumbnail (aspect 1.3, 9px corners, existing `assets/map-styles/*.webp`,
  dark thumbnail for Auto in dark mode) and the label below (11px). Selected: `bg-primary-container`
  `text-on-primary-container`, label semibold; the background is a `motion.span layoutId` that slides between
  options (POP_SPRING). `role="radiogroup"` / `role="radio"` as now.

### Groups

Group headings: 11px uppercase muted semibold, 12px top margin. Rows are grouped Beheer-style (2px gaps, 16px outer /
6px inner corners, `bg-beheer-row`), each: 16px muted lucide icon, label (13px semibold), control on the right.

| Group | Row | Icon | Control | Store |
|---|---|---|---|---|
| Spel | Groepen | `UsersIcon` | switch | `showTeams` |
| Spel | Groepscirkels | `CircleDashedIcon` | switch | `showGroupCircles` |
| Spel | Tegenhunt-cirkel | `TargetIcon` | switch | `showHomeCircle` |
| Spel | Markers | `MapPinIcon` | two toggle buttons "1", "2" | `showMarkersPart1`, `showMarkersPart2` |
| Spel | Voorspelling (only while predictions are on) | `SparklesIcon` | switch | `showPredictions` |
| Team & kaart | Auto's | `CarIcon` | switch | `showDevices` |
| Team & kaart | Life360 (only with a linked account) | `UserRoundIcon` | switch | `showLife360` |
| Team & kaart | 3D-gebouwen | `Building2Icon` | switch | `showBuildings3d` |
| Eten | McDonald's / KFC / Burger King | brand logo | logo button | `showMcDonalds` / `showKfc` / `showBurgerKing` |

- Switch: the existing `BeheerSwitch`.
- Markers buttons: a small segmented pair (`bg-card` track, 9px corners, 2px padding); each 28×24, on =
  `bg-primary-container text-on-primary-container`, off = muted; `aria-pressed`, labels "Speelhelft 1" / "Speelhelft 2".
- Eten: 3 equal tiles (`bg-beheer-row`, 12px corners), each the 28px brand tile (same look as the marker: brand colour,
  2px white rim, logo from `brand-logos.ts`) above the name (11px semibold). Off: logo greyscale at 45% opacity,
  muted name; on: tile `bg-primary-container`, name `text-on-primary-container`. `aria-pressed`. Colour and
  greyscale changes transition (200ms).

### Data

`useLayerToggles` is replaced by `useLayerGroups(fetchLife360: boolean)` in `components/settings/layer-toggles.ts`,
returning the groups above as data (id, label, icon, checked, toggle; markers as one entry with two parts; fastfood as
three brand entries), with the same conditions for Voorspelling and Life360. The panel renders that data; tests cover
the pure part (a `layerGroups(state, options)` function: rows per group, conditional rows, order).

## Desktop — `MapLayersControl`

Same map button and Popover (330px, scrollable to the available height); its content becomes `<MapLayersPanel />`.
Tour target `map.layersButton` unchanged.

## Phone — settings menu + drawer

- The settings dropdown (`components/Settings.tsx`, used by SidebarHeader / MobileMenu) drops the "Kaartstijl" and "Lagen" submenus for one item
  "Kaart & lagen" (`LayersIcon`) that closes the menu and opens a `ResponsiveDialog` (drawer on phones) titled
  "Kaart & lagen" with `<MapLayersPanel />`.
- Delete `MapStyleSubmenu.tsx` and `LayersSubmenu.tsx` (and their now unused imports).
- The panel's `fetchLife360` is true while the drawer/popover is open.

## Uniform close buttons

Reference: `DIALOG_SHELL` close — 34×32 button, 12px corners, `bg-beheer-row` (hover `bg-beheer-row-high`),
`text-muted-foreground`, lucide `XIcon` 16px, 16px from top/right.

- New `components/ui/close-button.tsx` exporting `CloseButton` (the button itself, `onClick`, `className`) and
  `CLOSE_BUTTON_CLASS`, so non-Radix places use the same look. `DIALOG_SHELL` keeps styling Radix's built-in close.
- **Map popups** (`MapPopup`): `closeButton={false}` on the MapLibre `Popup` and a `CloseButton` positioned
  `absolute top-3 right-3` inside the card (popup padding 14px). Remove the `.maplibregl-popup-close-button` CSS.
  `DockedPopup` uses `CloseButton` too (it already looks like it).
- **ResponsiveDialog**: desktop `DialogContent` gets `DIALOG_SHELL` by default (callers that already pass it keep
  working — `cn` merges); the phone drawer (vaul, in ResponsiveDialog) keeps closing by
  handle swipe / Back as today — no button added.
- **Other dialogs** without the shell: `RenamePasskeyDialog`, `MarkerRegistration`, `TrackerGuideDialog`,
  `DebugInfo` → add `DIALOG_SHELL` to their `DialogContent` (and the shell's window background like the others,
  `bg-card`); `QrConfirmDrawer` → `CloseButton` where its close sits now; `ImageLightbox` → `CloseButton` with
  `bg-black/50 text-white hover:bg-black/65 backdrop-blur` (same size, corners and icon) so it reads on photos.
- Hover/press transitions as on the Account dialog.

## Out of scope

Hover tooltips, the marker registration form fields, other menus.

## Testing

- Unit: `layerGroups` (groups and order; Voorspelling hidden when predictions are off; Life360 only when linked;
  markers parts map to the two store flags).
- `tsc -b`, eslint, full `bun test`, `vite build`.
- Browser (local server, light + dark, desktop + 390px): popover and drawer panel, style bar slide, every switch and
  the 1/2 and logo buttons toggle their layers; close buttons on a map popup, the docked popup, Account, Meldingen,
  Marker registration, Rename passkey, Tracker guide, lightbox.
