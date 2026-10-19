# Fastfood layers + map popup restyle — design

Date: 2026-10-19 · Repos: server + client · Mockups: `.superpowers/brainstorm/65669-1792414031/` (markers) and
`.superpowers/brainstorm/98339-1792416537/` (popups) in the workspace root.

## Goal

Hunters want to see where they can eat at night. Add three map layers — McDonald's, KFC, Burger King — off by default,
toggled from the layers menu. Clicking a restaurant opens a popup with its opening status. At the same time, restyle
every map popup in the new site style (Meldingen / Account / Beheer look).

Out of scope: hover tooltip restyle (only the new fastfood tooltip is added, in the existing tooltip style), the marker
registration dialog, Android app, other chains.

## User decisions

- Marker: **square tile B** — 28px rounded square (9px corners), 2px white rim, brand colour fill, real brand logo.
  Closed = grey + 60% opacity. Unknown hours = full colour.
- Logos: McDonald's Golden Arches, KFC 2026 bucket logo, Burger King 2020 logo (SVGs from Wikimedia Commons).
- Data: **OpenStreetMap via Overpass**, cached by the server.
- Popup: **A — grouped rows** in the new style, no week overview.
- All other map popups restyled in the same style A; every primary action becomes a soft-orange **Route** button.

## Server (`jotihunt-tracker-server`)

### Data source

One Overpass query for all of the Netherlands:

```
[out:json][timeout:90];
area["ISO3166-1"="NL"][admin_level=2]->.nl;
nwr["brand:wikidata"~"^(Q38076|Q524757|Q177054)$"](area.nl);
out center tags;
```

About 600 elements. Primary endpoint `https://overpass-api.de/api/interpreter`, fallback
`https://overpass.kumi.systems/api/interpreter`. Request with a descriptive User-Agent and a 120 s timeout.

### Files

- `services/fastfood.client.ts` — fetch Overpass (primary, then fallback); returns raw elements; throws on both failing.
- `services/fastfood.helpers.ts` — pure functions:
  - `brandOf(tags)` → `'mcdonalds' | 'kfc' | 'burgerking' | undefined` from `brand:wikidata`.
  - `toRestaurant(element)` → `Restaurant` or `undefined` (no coordinates / unknown brand).
  - `openIntervals(openingHours, from, days = 8)` → `{ start: Date; end: Date }[]` via the `opening_hours` npm library,
    evaluated in Europe/Amsterdam (country `nl`, so `PH` works). Unparseable or missing → `undefined`.
    Intervals that run past midnight stay one interval. Merge adjacent intervals.
- `services/fastfood.service.ts` — `refreshFastfood()` fetches, maps, upserts every restaurant by `osmId`, then deletes
  ids not in this fetch (never empties the collection mid-refresh); on failure logs and keeps the old data. A fetch
  with fewer than 100 restaurants counts as a failure (protects against a truncated Overpass answer). `listFastfood(now)` returns all restaurants with intervals computed from `now` (computed per request,
  cached in memory for 10 minutes, so intervals never go stale).
- `models/fastfood.model.ts` — collection `fastfood`.
- `controllers/fastfood.controller.ts` + `routes/fastfood.route.ts` — `GET /fastfood`, logged-in users (same auth as
  `/teams`). Response `Cache-Control: private, max-age=300`.
- `crons/fastfood.cron.ts` — daily at 04:00, plus at startup when the collection is empty. Registered in `schedule.ts`.

### Stored document

```ts
interface Restaurant {
  osmId: string;          // "node/123", unique
  brand: 'mcdonalds' | 'kfc' | 'burgerking';
  branch?: string;        // `description` or `branch` tag minus the brand name, e.g. "Arnhem Rijnstraat"
  location: { type: 'Point'; coordinates: [lng, lat] };
  street?: string; houseNumber?: string; postcode?: string; city?: string;
  phone?: string;         // phone ?? contact:phone
  website?: string;       // website ?? contact:website ?? url
  driveThrough?: boolean; // drive_through yes/no; absent → undefined
  openingHours?: string;  // raw OSM value
  updatedAt: Date;
}
```

API item = the document without `_id` plus `intervals?: { start: string; end: string }[]` (ISO) — `undefined` when
hours are unknown, `[]` when known but closed for the next 8 days.

## Client (`jotihunt-tracker-client`)

### Layers

- `layers.store.ts`: `showMcDonalds`, `showKfc`, `showBurgerKing` + toggles; default `false`; persisted like the rest
  (no version bump: persist's merge gives existing users the `false` defaults).
- `layer-toggles.ts`: three rows at the end — "McDonald's", "KFC", "Burger King". Appear in `MapLayersControl`
  (desktop) and `LayersSubmenu` (phone) automatically.
- `hooks/fastfood.hook.ts`: SWR `GET /fastfood`, only when any of the three is on; refresh every 30 min.

### Markers

- `src/assets/brands/{mcdonalds,kfc,burgerking}.svg`.
- `marker-icons.ts`: new key `{ kind: 'fastfood'; brand; closed: boolean }`. Draw: shadow, 28px white rounded square
  (9px corners), inner brand-colour square (2px rim), logo image centred (McD 15px wide, KFC 17px, BK 19px). Closed →
  greyscale + `LOCKED_ALPHA`-style fade (0.6). Logos are loaded as `HTMLImageElement`s before the icons register.
  Brand colours: McDonald's `#DB0007`, KFC `#E4002B`, Burger King `#F5EBDC`.
- `layers/FastFood.tsx` (+ `layers/fastfood/FastFoodPopup.tsx`, `FastFoodTooltip.tsx`): one GeoJSON source + symbol
  layer + hover layer (icon-size 1.1), modelled on `Teams.tsx`; filtered by the three toggles; `closed` per feature from
  `fastfoodStatus(now)`, with `now` ticking every 60 s. Click → popup + `easeTo`; clicking the open one closes it.
  Drawn below the group/fox layers so game markers stay on top.
- Tooltip (existing style 1): `● McDonald's · open tot 01:30` (dot in brand colour; status text per below).

### Status — `lib/fastfood-status.ts`

`fastfoodStatus(intervals, now)` →

| state | when | row text |
|---|---|---|
| `open` | inside an interval, ends > 30 min from now | **Open tot HH:MM** · nog X u Y min |
| `closing` | inside an interval, ends ≤ 30 min | **Sluit om HH:MM** · nog N min |
| `closed` | not inside; next interval exists | **Dicht** · opent {vandaag/morgen/weekday} HH:MM |
| `closed` | no next interval in 8 days | **Dicht** · opent niet in de komende week |
| `unknown` | `intervals` undefined | **Openingstijden onbekend** · niet bekend in OpenStreetMap |

An interval ending at 24:00 that is followed directly by one starting at 00:00 counts as one (server merges).

### Popup A — `FastFoodPopup.tsx`

Header: tile icon (36px, same look as the marker), title brand name, subtitle `branch · distance`. Rows (grouped):

1. Status row — tonal: open green (`--map-success-bg` / `--map-success`), closing orange (`#ffedd5` / `--map-warn`),
   closed red (`--map-danger-bg` / `--map-danger-fg`), unknown neutral. Text swaps with a fade (FadeSwap).
2. Address — `street houseNumber` / `postcode city`.
3. Drive-thru — only when `driveThrough` is defined ("Drive-thru" / "Geen drive-thru").

Actions: **Route** (primary) and, when `phone` exists, a 44px call button (`tel:`).

### Popup restyle (all map popups)

Shared building blocks change; every popup follows:

- `MapPopup` / `index.css`: 248px wide, 24px corners, 14px padding, layers-popover shadow; close button 34×32 tonal
  (`bg-beheer-row`, 12px corners) at 12px/12px. Docked phone popup gets the same inner look.
- `PopupHeader`: 36px icon (`PopupIcon` 11px corners for squares), 15px bold title, 12px muted subtitle; stale still
  greys the icon and colours the subtitle `--map-warn`.
- `PopupFacts`/`PopupFact` → `PopupRows` / `PopupRow` (icon, title, optional meta, optional trailing, `tone`) and
  `PopupRowSplit` (two rows side by side). Grouped: 2px gaps, 6px inner corners, 16px outer corners,
  `bg-beheer-row`.
- `CoordRows`: WGS84 / RD as `PopupRow`s with uppercase label, tabular value, copy (and hint lightbulb) as trailing
  ghost buttons.
- `PopupActions`: 40px buttons, 12px corners; variants `primary` (`primary-container`), `neutral`
  (`beheer-row-high`), `danger`, plus `success` for the visited house. Icon buttons are 44px wide.
- `MapsAction` → `RouteAction`: label "Route", primary, opens Google Maps directions
  (`https://www.google.com/maps/dir/?api=1&destination=lat,lng`).

Per popup:

- Groep: address row; visit-status row (green check when visited, sparkles + muted otherwise); Route + house toggle.
- Hunter: split row speed | battery (speed hidden when stale); Route as 44px icon button + the existing Hunt/Spot buttons.
- Vos-marker: estimate note stays under the header; coordinate rows; Route + delete (danger).
- Life360: split row driving | battery; accuracy row when usable; Route.
- Gekozen locatie: coordinate rows with hint lightbulb; Route as 44px icon button + the existing Hunt/Spot buttons.

All enter/exit/swap states animate (motion/react), per the app rule.

## Error handling

- Overpass down: server keeps the last data; first-ever fetch failing → `GET /fastfood` returns `[]`, retried by the
  next cron run and at the next start.
- Unparseable `opening_hours`: treated as unknown; logged once per refresh with the count.
- Client fetch failure: layer simply shows nothing; no toast (it's an optional layer).

## Testing

- Server: `toRestaurant` mapping (brand, branch, address, phone fallbacks, drive-thru), `openIntervals` (normal day,
  past midnight `Fr,Sa 08:30-01:30`, `24/7`, `off`, invalid → undefined, DST week), service fallback keeps old data,
  route auth + shape. Fixture: a few real elements from the 2026-10-19 sample.
- Client: `fastfoodStatus` for every state incl. the 30-min boundary and the after-midnight case; layer store defaults
  and migration; icon key mapping. `tsc -b` + tests green.
- Local E2E on a throwaway DB + server port, then check every popup in light and dark mode on desktop and phone width.
