# HQ screen redesign ("Vossenbord" + map director)

Date: 2026-10-13 · Status: approved in brainstorm · Mockups: `.superpowers/brainstorm/3726652-1791907078/content/camera-v2.html`

## Goal

The admin-only `/hq` wall screen (shown on a **beamer** in HQ) is rebuilt to match the main app's look and to be
readable from across the room. Clean, informative, not cluttered. The map is no longer static: a "camera director"
tours the active foxes and flies to events.

Today's screen (`pages/Hq.tsx`, `components/hq/*`) uses ad-hoc classes (bordered tinted tiles, `font-mono text-6xl`
clock, plain list) and a pulsing full-screen colour flash on every alert. All of that goes.

## Layout

16:9, full viewport, `grid-cols-[58fr_42fr]`, no page scroll. Theme follows the app setting (`useTheme`, `.dark` on body).

- **Left: map** (58%). The app's own `Map` component (same Material style, markers, layers, predictions), with all
  controls hidden and user interaction disabled. Right-hand corners rounded (`rounded-r-[1.1em]`, `overflow-hidden`).
  Overlays: tour chip (top-left) and event card (bottom).
- **Right: panel** (42%), `bg-background`, padding + gap like the sidebar, three blocks stacked:
  1. **Top card**: clock (`HH:MM`, large, bold, tabular), "Volgende hint" countdown (primary colour, from
     `useNextHint`), hunts count + points (`huntListItems`/`totalPoints`). When an assignment is open
     (`latestNonHintArticle` with a future `endTime`), one extra line: `Opdracht · <title> · <countdown>` (title
     truncated).
  2. **Fox board**: 3×3 grid of fox tiles, one per area (all areas from `useAreas`, in their order). Tile = sidebar
     card styling; header row: area dot (`getColorFromArea`) + name, green `CookieBadge tone="ok"` on the right when
     Actief; big status word in the FoxPills group colour: `Actief` / `Onderweg` / `Inactief`, or the cooldown
     countdown (`huntCooldownMs`) in blue; meta line `hunt HH:MM` (+ `cooldown ·` prefix). Grouping logic identical to
     `FoxPills` (cooldown wins; unknown status = Inactief). The tile the camera currently focuses gets a primary
     outline + slight scale (transition 600 ms).
  3. **Hunts card** (fills remaining height): title "Hunts" + summary "laatste 3", the 3 newest reports rendered with
     `HuntTimelineItem` (no-op `onSelect`). A newly arrived report slides in (fade + translate, 1 s, decelerate).

All sizes scale with the viewport: while `/hq` is mounted the root font size is set to `1.3vw` (restored on unmount),
so every rem-based class (including reused components like `HuntTimelineItem`) scales, so the screen looks the same at 1080p and on a beamer. Colours only from theme tokens and the
existing group colours (`text-green-700 dark:text-green-400`, etc.). System font, `tabular-nums` on every number.

## Map director

Pure logic in `lib/hq-director.ts` (unit-tested); a `MapDirector` component drives the map via the existing `MapRef`
(`flyTo` exists; add `fitBounds` to `MapRef`).

### Focus point per area

1. `prediction.pin` (AI fox position), else
2. `prediction.lastObservation` (hint/hunt/spot), else
3. centre of that area's groups (`useTeams`), else the area is not tourable.

### Tour (idle)

Stops: `overview` → each area currently **Actief or Onderweg** (not in cooldown, not red), in area order → back to
`overview`. Stop list is recomputed at each step, so status changes are picked up. With no tourable areas the camera
stays on overview.

- Overview = `fitBounds` over all teams (game area), padding ~30 px.
- Area stop = `flyTo` focus point at zoom **11.6** (town + roads visible, not street level).
- Flight: ~8 s, `curve: 1.25`, ease-in-out. Dwell: **20 s** per stop (after the flight).

### Events

Events interrupt the tour, are queued FIFO, and each holds **30 s** (after the flight). When the queue empties the
tour resumes from where it was.

| Event | Source | Camera | Card |
| --- | --- | --- | --- |
| Fox status change | notification feed `fox-status` | fly to area focus | "Delta is Actief" · "Was Onderweg" |
| New hunt | new id in `useHuntReports` (after first load) | fly to area focus, zoom 12.4 | "Hunt op Bravo!" · code · reporter · cooldown started |
| Cooldown over | client clock: area's cooldown crosses 0 | fly to area focus | "Foxtrot is weer te hunten" |
| Tegenhunt | notification feed `counter-hunt` | fly to home team (clubhouse), zoom ~12.2, sector visible | "Tegenhunt!" · direction |
| Broadcast, new hint, article, hunt deadline, happy hour | notification feed | **no camera move** (camera holds where it is while the card shows) | card only |

Duplicate events for the same thing within the hold window are collapsed (e.g. a hunt and its status change).

### Overlays

- **Tour chip** (top-left, card styling): timer ring around the area dot + `Rondleiding · <Area> · <status>` (or
  `Overzicht`) + step dots for the tour stops. Hidden (fade) while an event is shown.
- **Event card** (bottom, full map width minus margin, slides up 900 ms decelerate): event icon (`CookieBadge`, colour
  per event; danger for tegenhunt) inside a timer ring in the event colour, title (large, bold) + one muted line, step
  dots showing queued events.
- Focused fox marker pulses (ring in area colour) while focused.
- Timer ring + step dots are the **website tour's** components: extract `TimerRing` and `StepDots` from
  `components/tour/TourCard.tsx` into shared components and use them in both places (tour behaviour unchanged).

## Alerts and sound

- Full-screen `AlertBanner` is **removed**; every alert goes through the event card.
- Sounds unchanged (`useNotificationFeed` with `respectPreferences: false`, `toasts: false`).
- `AudioUnlock` stays, restyled in app style (card on dimmed background, `Volume2Icon`, "Klik om geluid aan te zetten").

## Unchanged

Admin-only route guard, own `SWRConfig` with session-expiry handling, `DemoReloader`, `StaleDataBadge`,
`ErrorBoundary` around each block.

## Code structure

- `pages/Hq.tsx`: layout only.
- `components/Map.tsx`: new optional `wall` prop: hides the map controls (zoom, locate, fullscreen, ruler), search
  overlays and popups, and disables user interaction. `MapRef` gains `fitBounds`. Default behaviour unchanged.
- `components/hq/`: `HqTopCard`, `FoxBoard` (+ `FoxTile`), `HqHunts`, `MapDirector`, `TourChip`, `HqEventCard`,
  `AudioUnlock` (restyled). Delete `AlertBanner`, `AreaTiles`, `HqClock`, `HuntFeed`, `LatestArticle` once replaced.
- `components/tour/TimerRing.tsx`, `components/tour/StepDots.tsx`: extracted, used by `TourCard` and HQ.
- `lib/hq-director.ts`: `foxGroup(area, cooldown)`, `focusPoint(area, prediction, teams)`, `tourStops(...)`,
  event queue reducer (enqueue/collapse/advance), `eventFromNotification(...)`, hunt/cooldown diff helpers.
- `lib/hq.ts`: drop `bannerClass`; keep `latestNonHintArticle`.
- `prefers-reduced-motion`: flights become instant jumps, no slide/pulse animations.

## Testing

- Unit tests (`bun test`) for `lib/hq-director.ts`: grouping, focus fallback chain, tour stop list (skips red/cooldown,
  overview only), queue order/collapse/resume, event mapping per notification type, new-hunt and cooldown-end detection.
- Update `lib/hq.test.ts` for the removed `bannerClass`.
- `tsc -b`, lint, existing tour tests still pass after the ring/dots extraction.
- Manual: `/hq` at 1920×1080 and 1280×720, dark + light, trigger events with the demo world.
