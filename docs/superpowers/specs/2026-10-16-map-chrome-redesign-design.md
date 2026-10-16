# Map chrome + sidebar buttons redesign (map C, sidebar B)

Date: 2026-10-16. Picked via visual companion (`.superpowers/brainstorm/571436-1792165138/content/map-controls-v2.html`
option **C — M3 segmented**, `sidebar-buttons-v2.html` option **B — zacht oranje**).

## Top bar (desktop: `CoordinatesCard`, `SearchCard`)
- Each field a 44px tile, 14px corners, `bg-card`, no border, shadow `0 0 0 1px var(--border), 0 4px 14px rgb(0 0 0/0.22)`.
- Leading 32px chip (`rounded-[10px] bg-beheer-row-high`) with the icon: Search (coordinates), Navigation (groups).
- Bekijk: h-8, 9px corners, soft orange `bg-primary-container text-on-primary-container`.
- Invalid coordinate: 2px destructive outline instead of the red border; focus: 2px ring outline.
- Group picker: chip + label + ChevronsUpDown, `hover:bg-beheer-row`; popover as wide as the trigger.

## Map buttons (desktop, bottom right, `src/index.css`)
- 40px buttons on `bg-card` with the same ring + shadow; hover `bg-beheer-row-high` (150ms colour fade).
- Layers alone, 12px corners, `bg-primary-container`, icon `text-on-primary-container`.
- Zoom +/− one group; geolocate, fullscreen, ruler one stack. 2px gaps inside a group, 12px outer / 4px inner corners,
  6px between groups.
- Active states (geolocate active/background/waiting, ruler `-active`) get `bg-primary-container`.
- Icons stay MapLibre / ruler glyphs.

## Sidebar
- Open hints (`HintMiniGrid`): full width tonal (`bg-beheer-row-high`, hover 14% mix), 12px corners, no border, arrow.
- Hunt registreren (`HuntsSection`): soft orange `bg-primary-container text-on-primary-container`; Alle: tonal.
- Both h-9, 12px corners. Empty state unchanged. Shared class strings in `src/lib/tonal-button.ts`.

## Verification
lint, build, tests; screenshots light + dark of the app with the top bar, map buttons and sidebar.
