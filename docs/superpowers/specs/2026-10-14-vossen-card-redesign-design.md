# Vossen card redesign — design

Date: 2026-10-14. Picked in the visual companion: direction **C** (status bar + tonal groups), chip variant **C2** (area-colour dot + name).

## Goal

Restyle the sidebar "Vossen" card (`FoxPills`) to the new site look: the M3 status roles of the map markers, tonal surfaces like the Mijn tracker / Life360 cards, no "geen" rows, and animation on every state change.

## Layout (open card)

1. **Status bar** — 9 segments (one per area, `flex-1`, 3px gap, 10px high, outer segments get the larger radius), coloured with the status *foreground* role of the fox's group. Segment order = group order, cooldown foxes by remaining time ascending, otherwise area order (alpha … oscar).
2. **Legend** — one line, space-between: `<count> actief · <count> onderweg · <count> cooldown · <count> inactief` (count bold `text-foreground`, label muted, 11px).
3. **Groups** — group order **Actief → Onderweg → Cooldown → Inactief**. Only non-empty groups render. Each group is a rounded-2xl (14px) block with the group's tonal container as background (dark: container mixed ~55% into `--card`; light: ~75%), header row `<label> … <count>` (12px bold, on-container colour), then wrapped chips.
4. **Chip (C2)** — rounded-full, h-26px, translucent background (dark `rgba(0,0,0,.28)`, light `rgba(255,255,255,.7)`), text in the group's on-container colour, 12px semibold: 7px dot in `getColorFromArea(area)` + capitalised name; cooldown chips append `mm:ss` (`formatCountdown`, `tabular-nums`, 80% opacity).
   - Click toggles map visibility (`toggleHidden`), `aria-pressed={!hidden}`; hidden chips at 40% opacity.
   - `title`/`aria-label` keep today's text (status, updated-ago, last hunt, cooldown, verborgen).

## Collapsed header

`SidebarSection` `summary` = a mini status bar (≈90px wide, 8px high, same segments/order). Replaces the `statusSummary` text; delete `statusSummary` (no other users).

## States

- Loading (`areas` undefined): skeleton bar + two skeleton group blocks.
- No areas (`[]`): muted "Nog geen vossen".
- Pre-game (all red): bar fully red, one "Inactief 9" group.

## Colours

New CSS custom properties in `src/index.css` for light and dark, mirroring `MARKER_PALETTES` status roles plus a new cooldown blue:

| role | light container / on / fg | dark container / on / fg |
|---|---|---|
| ok (Actief) | #b7f2ae / #0b3a0e / #2f6b2c | #1e5120 / #b7f2ae / #9bd893 |
| warn (Onderweg) | #ffddb8 / #4a2800 / #8b5000 | #693c00 / #ffddb8 / #ffb870 |
| cooldown | #cfe5ff / #001d32 / #0b5d95 | #0f4a73 / #cfe5ff / #93ccff |
| error (Inactief) | #ffdad6 / #93000a / #ba1a1a | #93000a / #ffdad6 / #ffb4ab |

Exposed as Tailwind colours (e.g. `fox-ok-container`, `on-fox-ok-container`, `fox-ok`).

## Animation (motion/react, `MotionConfig reducedMotion="user"` already global)

- Chips are `motion` elements with a shared `layoutId` per area inside a `LayoutGroup`, so a status change slides the chip into its new group.
- Groups enter/exit via `AnimatePresence` (height + opacity), surrounding blocks `layout`-animate.
- Bar segments: `layout` reorder + CSS `background-color` transition.
- Counts (legend + group header) swap with a short vertical fade (`AnimatePresence mode="popLayout"` keyed on the value).
- Hidden toggle: opacity transition.

## Code structure

- `src/lib/fox-status.ts`: add `FOX_GROUP_ORDER`, `sidebarFoxes(areas, hunts, reports, now)` → sorted `{ key, name, area, group, cooldownMs, lastHunt }[]`, and `groupCounts(foxes)`. Reuse `lastHuntTimeFor`, `huntCooldownMs` and the existing `foxGroup` (move it from `hq-director.ts` to `fox-status.ts` if needed, keeping hq imports working). Unit tests in `fox-status.test.ts`.
- `src/components/sidebar/foxes/`: `FoxStatusBar.tsx` (props: foxes, size `'full' | 'mini'`), `FoxGroups.tsx`, `FoxChip.tsx`, `FoxesCard.tsx` (hooks + 1 s interval, replaces `FoxPills.tsx`, which is deleted).
- `SidebarSections.tsx`: use `FoxesCard` and pass the mini bar as summary (the bar needs hunts/reports/now too, so `FoxesCard` exports a `FoxesSummary` component using the same hook).
- `hq-director.ts` comment referencing FoxPills updated.

## Testing

- `npx --yes bun test` for the new grouping/sorting helpers (order, cooldown sort, unknown status → red, empty input).
- `tsc -b` + lint.
- Browser check on vite :5174 against the prod API, light + dark, with statuses mocked to see group moves/enter/exit animations and the collapsed bar.
