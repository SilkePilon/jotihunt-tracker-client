# Sidebar Redesign — Design

Date: 2026-09-27
Status: approved (brainstorm), pending implementation plan
Repo: `jotihunt-tracker-client`, branch `feat/sidebar` (stacked on `feat/maplibre`)
Mockups: `.superpowers/brainstorm/*/content/sidebar-concepts.html` (option 7) and `hints-overview.html` (option B)

## Goal

Replace the current stack of large cards on the left of the main map page (`src/pages/App.tsx`) with a
compact, collapsible accordion (concept 7) that also shows a mini hint-board grid, and use a bottom
sheet on mobile. The map should get more room while the essentials (countdown, fox status, hint
progress) stay visible.

## Scope

In scope: layout and presentation of the main-page sidebar; mini hint grid; moving active hunters
into the sidebar; mobile bottom sheet; `/hints` deep link to a cell.
Out of scope: search card and coordinates card (stay top-right on desktop), the `/hints` and `/users`
pages themselves (except the deep-link param), any server changes.

## Desktop layout (≥ md)

Floating stack of small cards, left side, `w-[320px]`, gap 6px, scrolls vertically when taller than
the viewport. Order:

1. **Header** (always visible, not collapsible): logo (`LOGO_URL` fallback `/pwa-512x512.png`),
   "Jotihunt Tracker" + `GROUP_NAME`, countdown pill, settings menu (existing `Settings` component).
   - Countdown pill `⧗ mm:ss` to the next hint; turns red in the last 5 minutes. The logic of
     `NextHintTimeCard` (next-hint time from articles + `hint-alert.mp3` on a new hint, not on
     first load) moves into a hook `useNextHint()` used by the pill. The large card is removed.
2. **Vossen** (default open): 9 compact pills `A B C D E F G H O`, each coloured by fox status
   (red/orange/green, same data as `FoxStatus`), with the area colour as a small dot. Clicking a
   pill toggles hiding that area on the map (existing `hiddenareas.store` behaviour).
   Collapsed summary: `3 groen · 3 oranje · 3 rood`.
3. **Hints** (default open): mini grid of the **last 4 hint articles** (rows, newest on top,
   label = publish time `HH:mm`) × 9 areas (columns, header letters). Cell colours:
   solved = green, solving = amber, open = grey, none = dashed outline.
   Clicking a cell navigates to `/hints?article=<id>&area=<area>`; button "Open hint board ↗" navigates
   to `/hints`. Data from existing `useHintBoard()` (3 s polling). Empty state: "Nog geen hints".
   Collapsed summary: `<solved>/<total> opgelost`.
4. **Hint registreren** (default closed): existing `HintEntryCard` form content, without its Card chrome.
5. **Tegenhunt** (default closed): existing `CounterHuntCard` content; section only rendered when
   `HOME_TEAM_API_ID` is set (as today).
6. **Actieve hunters** (default closed): content of `ActiveDevices` (moved from the bottom-right map
   overlay, which is removed). Collapsed summary shows the count, e.g. `4`; "Niemand" when 0.

Open/closed state per section persists in localStorage via a new zustand store
`src/stores/sidebar.store.ts` (`openSections: Record<SectionId, boolean>`, `toggle(id)`), defaults as
listed above.

## Mobile layout (< md): bottom sheet

shadcn `Drawer` (vaul 1.1, React 19 compatible), non-modal, always mounted, 3 snap points:
- **Peek** (~120px): header row (logo, countdown pill, settings) + fox pills.
- **Half** (~50% height): + Hints grid and the collapsed section headers.
- **Full** (~90% height): everything, scrollable.
The map stays interactive above the sheet. Replaces the current mobile menu toggle
(`menu.store` + the menu button in `App.tsx`); the search card keeps its current mobile position.
Section content and order are identical to desktop (same components).

## Components

- `src/components/sidebar/SidebarSection.tsx` — collapsible wrapper: `id`, `title`, `summary?`
  (shown in the header row when collapsed), `children`. Uses `ui/collapsible` + `sidebar.store`.
- `src/components/sidebar/SidebarHeader.tsx` — logo, title, `CountdownPill`, `Settings`.
- `src/components/sidebar/CountdownPill.tsx` + `src/hooks/next-hint.hook.ts` (`useNextHint()`).
- `src/components/sidebar/FoxPills.tsx` — compact fox status.
- `src/components/sidebar/HintMiniGrid.tsx` + pure helper `lastHintRows(board, n)` in `src/lib/hints.ts`.
- `src/components/sidebar/Sidebar.tsx` — composes sections; renders desktop stack or mobile sheet
  (`useIsMobile` via `md` breakpoint media query).
- Existing `FoxStatusCard`, `HintEntryCard`, `CounterHuntCard`, `ActiveDevices`: split so the inner
  content can render without Card chrome (keep their logic; remove the wrapper Card or add a
  `bare` rendering), `NextHintTimeCard` removed after its logic moves to `useNextHint`.
- `src/pages/App.tsx` — renders `<Sidebar />` plus the existing top-right search/coordinates.
- `src/pages/Hints.tsx` — reads `?article=&area=` on mount to preselect a cell.
- `src/components/ui/drawer.tsx` — added via shadcn (vaul).

## Error / empty states

- No hint articles: "Nog geen hints" in the grid section.
- Board polling error: existing global SWR error toast (no extra UI).
- No active devices / Traccar unavailable: "Niemand".

## Testing

- Unit (`bun test`): `lastHintRows` — picks newest 4 articles, maps cells per area, handles
  missing cells and fewer than 4 articles.
- `bun run build`, `bun run lint`.
- Visual: headless Chromium screenshots (existing `/tmp/shot` approach) at 1280×800 (sections open
  and collapsed) and 390×844 (sheet at peek / half / full); check a grid-cell click lands on
  `/hints` with that cell selected.
