# OV fox status (`blue`) — design

_2026-10-17. On jotihunt day the API started sending `"status":"blue"` for Oscar (13:31 UTC). The rules only know
green/orange/red; Oscar is the fox team that travels by public transport. Our server dropped the entry (`Ignored 1
unknown or invalid entries`), so the app kept showing Oscar red from 2025._

## Meaning

`blue` = the fox team travels by OV. Not confirmed by the organisation, so it counts as **not huntable**.

## Server (jotihunt-tracker-server)

- `AREA_STATUSES` gets `blue`; Oscar is stored again.
- An unknown status is logged once per value with the value and area (`unknown status "purple" for Oscar`).
- Notifications: `STATUS_NL.blue = "met OV"`. Change to blue: title `OV: <Area> reist met OV — niet hunten`,
  body `Was <old>.`, not urgent. Changes away from blue use the existing texts (`Was met OV.`).
- Intel chat `STATUS_TEXT.blue = "met OV"`, `huntableNow` false; tool description mentions blue.
- Prediction prompt: blue = travelling by public transport, not huntable.
- Demo generator unchanged.

## Client (jotihunt-tracker-client)

### Logic (`src/lib/fox-status.ts`)

- `FoxGroup` gets `'ov'`, label `OV`. `FOX_GROUP_ORDER = green, orange, ov, cooldown, red`.
- `foxGroup('blue', cooldownMs)` = `'ov'`, also during a cooldown (not huntable anyway).
- `groupCounts` includes `ov`.
- Tokens `--fox-ov`, `--fox-ov-container`, `--fox-on-ov-container`, `--fox-ov-group` (indigo), light + dark;
  `GROUP_CLASS.ov`.
- HQ `GROUP_TEXT_CLASS.ov` indigo text (no HQ redesign). Map marker stays red (`foxStatus` unknown = red).
- Mobile `PeekStrip` follows `FOX_GROUP_ORDER`; its legend shows `ov` only when > 0.
- Chip/row tooltip status text: `met OV`.

### Vossen card: OV block (mockup G)

- Status bar: indigo segment per OV fox.
- Legend: the `ov` item only when its count > 0 (normally stays 4 items).
- The `ov` group renders as an indigo tonal block (same block shape as the others) without the usual header; per fox
  one row:
  - a button: area dot (lock when forbidden) + `<Name> · in het OV`, right `<n> min` since `area.updatedAt`
    (`< 1 min` under a minute, `1 u 5 min` from an hour), ticking with the card's clock;
  - a rail under it: dashed line between two station rings, a small indigo train with the train icon gliding
    left↔right (6 s ease-in-out, alternate, infinite). `prefers-reduced-motion`: train stands still in the middle.
  - Click toggles the area on the map (like a chip), hidden/forbidden dim like a chip.
- Motion: block folds in/out like the other groups; a row pops in/out like a chip (pop-in delayed 0.15 s).

## Tests

- Server: `parseAreasAnswer` keeps blue and reports unknown values; `buildFoxStatusNotification` blue texts;
  intel `STATUS_TEXT` blue.
- Client: `foxGroup`/`sidebarFoxes`/`groupCounts` with blue (with and without cooldown); OV minutes formatter.
- Browser check with a faked `/areas` (Oscar blue), light + dark, collapsed header, mobile peek strip.

## Out of scope

HQ/Vossenbord design, Android app, map marker colour.
