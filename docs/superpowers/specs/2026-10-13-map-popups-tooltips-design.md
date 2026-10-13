# Map popups and hover tooltips redesign

Date: 2026-10-13
Branch: `feat/popup-redesign` (client, off `main` at e410e29)
Mockups: `.superpowers/brainstorm/3595344-1791900905/content/` (`popups-a-v2.html` = chosen popup style, `tooltips.html` row 1 = chosen tooltip style)

## Goal

The map popups and hover tooltips are too big and still use the old shadcn look. The map markers were redesigned
(`feat/android-markers`, 8cf260c) as Android-style M3 shapes: 2px dark rim, soft shadow, green-tinted M3 surfaces,
Google Sans. Bring the popups and tooltips into that family and make them about 40% smaller.

Chosen directions: popup style **A (compact card)** and tooltip style **1 (one line)**.

## Scope

Popups: picked location (`PickedLocationPopup`), group (`TeamPopup`), hunter (`DevicePopup`), fox marker
(`MarkerPopup`), Life360 (`Life360Popup`), plus the shared wrapper `MapPopup`.

Tooltips: `MapTooltip` and its users `TeamTooltip`, `DeviceTooltip`, `MarkerTooltip`, `Life360Tooltip`.

Out of scope: the marker images themselves, the hunt registration dialogs, sidebar cards.

## Visual language

Colours come from `MARKER_PALETTES` in `src/lib/marker-style.ts` for the current theme (dark/light, following the
site's dark mode), exposed as CSS variables so popup chrome, building blocks and tooltips use the same values:

| Token | Use |
|---|---|
| `surfaceContainer` (dark ≈ `#1d211c`) | popup and tooltip background |
| `surfaceContainerHigh` (dark ≈ `#272b26`) | coordinate rows, neutral buttons, visit button group |
| `onSurface` / `onSurfaceVariant` | title / body text |
| muted (dark ≈ `#8c9388`) | subtitles, labels, close icon, tooltip meta |
| `primary` `#ea580c` | Hunt / Spot buttons |
| `primaryContainer` / `onPrimaryContainer` | picked-location icon, selected visit option |
| `errorContainer` / `onErrorContainer` | delete icon button |
| warn (dark ≈ `#ffb68a`) | stale subtitle text |

The values live as `--map-*` CSS variables in `src/index.css` (`:root` + `body.dark`), mirroring `MARKER_PALETTES` plus M3 `surfaceContainer` / `surfaceContainerHigh` for the app's green seed.
Font: `"Google Sans Flex", "Google Sans", Roboto, system-ui, sans-serif` (the marker font). Numbers use
`tabular-nums`. Icons stay lucide.

## Popup chrome (`MapPopup` + `index.css`)

- Width 236px (fixed, `maxWidth` stays as a guard), padding 10px, radius 16px, background `surfaceContainer`,
  1px `#ffffff10` hairline + `0 6px 20px rgb(0 0 0 / .5)` shadow, base text 12.5px.
- MapLibre tip recoloured to `surfaceContainer`; close button 24px round, muted icon 14px, top-right 8px.
- Per-popup offsets re-tuned so the tip sits just above each marker image.

## Building blocks (`src/components/map/popup/`)

- **`PopupHeader`** `{ icon, title, subtitle?, stale? }`: 32px icon slot + title (13.5px semibold) + subtitle
  (11.5px muted). `stale` turns the subtitle warn-coloured and greys the icon (`grayscale`, opacity .7). Leaves
  room for the close button.
- **`PopupIcon`** variants matching the marker shapes: `circle` (hunter: `secondaryContainer` + vehicle glyph;
  Life360: existing `Life360Avatar` at 32px), `square` (fox marker: area colour + area letter, 10px radius), `logo`
  (group: `TeamLogo` at 32px, 10px radius), `pin` (picked location: `primaryContainer` + `MapPinIcon`).
- **`PopupFact`** `{ icon, children }`: 13px muted icon + text line; several facts on one line are separated by a
  muted `·`.
- **`CoordRow`** `{ label: 'WGS84' | 'RD', value, copyValue, onHint? }`: tinted row (`surfaceContainerHigh`, 10px
  radius), 10px uppercase label over the mono value, 26px ghost icon buttons on the right: copy (existing
  `CopyButton` behaviour and toast) and, when `onHint` is given, lightbulb with the existing tooltip text.
  WGS84 shows 5 decimals (`52.10354, 5.82607`) and copies 7; RD shows `x · y` and copies `x, y`.
- **`PopupActions`**: row of 30px buttons with 6px gap and 9px radius. Variants: `maps` icon-only (30px square,
  `surfaceContainerHigh`) or full-width labelled; `primary` (Hunt/Spot, flex 1); `danger` icon-only.
- **`DistanceText`** via `useDistanceFromMe(lat, lng)`: returns `"2,4 km van jou"` or `undefined`.

## Distance from me

`useDistanceFromMe(lat, lng)`:
1. Own position = latest Traccar position whose `deviceId` equals the auth user's `tracker.deviceId`, if that
   position is not stale (same stale rule as the hunter markers).
2. Otherwise the browser position, only when the Geolocation permission is already `granted` (Permissions API);
   never prompts.
3. Otherwise `undefined`; the popup then shows no distance.

Distance is great-circle (haversine in `src/lib/own-position.ts`), formatted by a new pure `formatDistanceFromMe(metres)` in
`src/lib/format.ts`: `< 1000` → `"350 m van jou"`, else one decimal km with a Dutch comma (`"2,4 km van jou"`).
Hidden below 20 m (that is "you").

## Popups

**Gekozen locatie**
- Header: `pin` icon, "Gekozen locatie", subtitle = distance.
- `CoordRow` WGS84 (copy) and `CoordRow` RD (lightbulb = existing `setHintCoords`, copy), 4px apart.
- Actions: Maps icon · **Hunt** · **Spot** (`MarkerRegistration`, labels shortened from "Vos hunt"/"Vos spot";
  icons `LocateFixed` / `Glasses` stay).
- The pulsing blue picked-location dot is unchanged here (marker work owns it).

**Groep**
- Header: `logo` icon, team name, subtitle = `● Area` in the area colour (or "Geen deelgebied" muted) · distance.
- Fact: `MapPin` · `accomodation · street number[addition], city` (postcode dropped for width).
- `VisitControls` restyled: status text 11px muted, then a 3-way connected button group (26px high, 2px gaps,
  outer corners 9px, inner 4px); selected = `primaryContainer`. Logic unchanged.
- Area editing select (when `TEAMS_AREA_EDITING`) stays, `size="sm"`, full width.
- Actions: full-width labelled "Google Maps" (`surfaceContainerHigh`).

**Hunter (Traccar)**
- Header: `circle` icon with the device's vehicle glyph, device name, subtitle = age (`formatDistanceToNow`) · distance.
  Stale (marker stale rule) → `stale` header, subtitle `"<age> · laatst bekend"`.
- Fact line: `Gauge` speed · `Battery` battery.
- Actions: Maps icon · Hunt · Spot.

**Vos-marker**
- Header: `square` icon in the area colour with the area letter, title `"<Area> · <type>"`, subtitle = marker time
  (`formatMarkerTime`) · distance.
- `CoordRow` WGS84 (copy) and RD (copy, no lightbulb).
- Actions: full-width labelled "Google Maps" + `danger` delete icon button (`Trash2`, `aria-label="Verwijderen"`)
  that opens the existing `ConfirmDialog`. Delete logic and toasts unchanged.

**Life360**
- Header: `circle` icon (avatar photo if present, else initials on the member colour), name, subtitle = age ·
  distance; `linkStale` → stale header, subtitle `"<age> · laatst bekend"`.
- Facts: driving text (`life360DrivingText`, only when present) · battery (+ " (laadt)"); second line accuracy
  (only when `hasUsableAccuracy`).
- Actions: full-width labelled "Navigeer".

## Tooltips (`MapTooltip`)

One line, no wrap: 8px colour dot · **name** (12.5px semibold) · meta (muted). Background `surfaceContainer`,
radius 10px, padding 6px 10px, hairline + `0 4px 12px rgb(0 0 0 / .5)` shadow, 8px arrow. `MapTooltip` gets
`{ color, title, meta? }` props instead of free children; no more `Badge`.

| Tooltip | Dot | Title | Meta |
|---|---|---|---|
| Group | area colour | team name | area name |
| Hunter | `onSecondaryContainer` (grey when stale) | device name | short age (`1 min`, `2 u`) |
| Fox marker | area colour | type (`Spot`, `Hunt`, `Hint`) | `Alpha · 14:32` |
| Life360 | rim colour for its tone (`life360RimColor`) | member name | short age |

Short age = existing `formatAgeShort(iso, now)` from `src/lib/life360.ts`: `nu`, `N min`, `N uur`.
Tooltip offsets re-tuned to the marker image heights.

## Testing

- Unit tests (bun) for `formatDistanceFromMe` (0, 19 m, 999 m, 1000 m), `joinParts`, `distanceMetres` and
  `ownTrackerPosition`.
- Update any existing tests that assert the old labels ("Vos hunt", "Breedtegraad", …).
- `tsc -b` and lint clean.
- Manual check in the local preview (throwaway DB, not the live docker stack): each popup and tooltip in dark and
  light mode, stale hunter and stale Life360, team without area, fox hint marker offset, copy and lightbulb still
  work, delete confirmation still opens, popup stays inside the map on a 360px wide phone viewport.
