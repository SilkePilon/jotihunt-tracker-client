# Alle hunts window redesign

Date: 2026-10-14. Status: approved in brainstorm (visual companion, `.superpowers/brainstorm/1124167-1791997191/content/`:
`hunts-lijst.html` → L4, `hunts-rij.html` → A, `hunts-status.html` → S2).

## Goal

Bring the "Alle hunts" window (`src/components/hunts/AllHuntsDialog.tsx`) into the new app style (Beheer window, map
markers) and remove the second view: the separate hunt detail (`HuntDetail.tsx`) goes away; tapping a hunt opens its
row in place.

## Picks

- **L4 shell**: the Beheer window frame with a nav column on the left.
- **Row A**: the map's hunt marker as the leading icon; the row expands to a photo banner, fact tiles and actions.
- **Status S2**: no coloured status pills. The status is coloured text at the start of the row's grey meta line.

## Window

- `ResponsiveDialog` like Beheer: `h-[640px] max-h-[85dvh] gap-0 overflow-hidden bg-beheer-window p-0 sm:max-w-[960px]
  sm:rounded-[20px]`, `hideHeader` (title/description stay for screen readers), drawer on phones.
- Desktop: `grid grid-cols-[220px_1fr]`.
  - **Nav** (Beheer N1 style): heading "Hunts", then four items with icon + label + count on the right:
    Alles (list icon), Te versturen (send), Ingestuurd (inbox), Beoordeeld (star). The count of "Te versturen" is orange
    (`text-orange-300` dark / `text-orange-700` light) when > 0, other counts muted. Unlike Beheer, counts are shown here
    because they are the point of the filter.
  - Under a small uppercase label "Deelgebieden": one item per area that has hunts, area-colour dot + name + points
    ("10 pt") on the right, 32px high. Picking an area filters to that area (status filter resets to Alles); picking it
    again clears it. Active item = the same sliding soft fill as Beheer (`layoutId`).
  - **Content**: `overflow-y-auto px-7 py-6`. Title (`text-[22px] font-bold`) = the active filter or area name; muted
    line "N hunts · totaal P pt" (area: "N hunts · P pt"). Then one `BeheerCard` without a title holding `BeheerRows`.
    Filter changes swap the content with `SWAP`.
- Phone: Beheer's pattern — the nav list first (h-12 items), tapping an item slides to the list pane with a back
  IconPill and the title (same `SLIDE` variants). Opening with `initialReportId` goes straight to the list pane.
- Filter rules stay as today: "Te versturen" = `to_submit` or `overdue` (plus hunts still being read); website-only hunts
  count only under Beoordeeld. Order stays as today. Paging stays: 200 rows, then a secondary Pill "Meer laden (N over)".
- Empty list: muted centred "Geen hunts in deze lijst." inside the card.

The nav item component is currently private to `BeheerDialog.tsx`; extract it (e.g. `beheer/WindowNav.tsx` with
`NavItem` gaining an optional trailing count) so both windows share it. Same for the phone list/pane slide if it can be
shared without bending either window.

## Row, closed

`BeheerExpandableRow` (one open row per card via `BeheerRows`' context):

- **Leading**: `HuntMarkerIcon` — a 48px SVG copy of the map's hunt marker: cookie (`MARKER_COOKIE_DEPTH`, from
  `lib/cookie-shape`) with a soft drop shadow, fill `tertiaryContainer`, the `photo_camera` glyph (24px) in
  `onTertiaryContainer`, and an 18px round badge bottom-right (`surfaceContainerLowest` fill) with the area letter in
  the area colour. Colours from `MARKER_PALETTES` for the current theme. Website-only hunts: same cookie in
  `surfaceContainerHighest` with a globe glyph in `onSurfaceVariant`.
- **Title**: the code in mono (`HuntCodeText`), "Onbekend" muted when there is no code, or spinner + "Wordt gelezen…".
- **Meta** (`text-xs text-muted-foreground`, one line, truncates): `<status> · <area> · <time> · <reporter>` where
  `<status>` is coloured semibold text:
  - Te versturen · mm:ss (live) — amber (`text-amber-700 dark:text-amber-300`, as the old badge); pulses (opacity) in the
    last 5 minutes (`prefers-reduced-motion`: no pulse).
  - Te laat! — red (`text-red-700 dark:text-red-300`). Ingestuurd — blue (`text-blue-700 dark:text-blue-300`). "{site status}" (e.g. Goedgekeurd/Afgekeurd) — green (`text-green-700 dark:text-green-400`), red when 0 points.
  - Wordt gelezen — muted (no separate status then; the title already shows the spinner).
  - Time shows "±HH:MM" when unknown. Reporter = `reportedByName`, or "jotihunt.nl" for website-only hunts.
  - Appended in amber: "· controleren" (`needsReview`) or "· dubbel?" (`duplicateOf`).
- **Trailing**: only for judged hunts the points, `text-sm font-bold` ("10 pt", green when > 0, muted when 0). Then the
  chevron.
- Live countdown: keep today's approach (only rows with `hasLiveCountdown` tick every second).

## Row, open

Unfolds under the header (the existing `Reveal`), full row width (`indentClassName` none), column `gap-2.5`:

1. **Photo banner**: `StickerHero` at ~190px (phone ~170px), `rounded-2xl`, zoomed on `stickerBox`, tap = lightbox (as
   today). Website-only: a muted box with a globe and "Geen foto — alleen op jotihunt.nl".
2. **Edit box** (admin, while "Bewerken" is on): the existing `HuntInlineEdit` code + time editors in a soft orange
   block (`bg-primary/8 rounded-xl`), Enter saves, Escape cancels.
3. **Fact tiles**: 3 columns (1 column on phone) of small tonal tiles (`bg-black/15` light: `bg-black/5`, on the open row's
   `beheer-row-high`, 6px radius, outer 14px): uppercase label + value.
   - Gemeld door: name · clock.
   - Bron: source label as today ("Gemini · 92% zeker", "Handmatig ingevuld", red "Lezen mislukt"); becomes
     "Ingestuurd door: name · clock" once submitted/judged.
   - jotihunt.nl: "status · N pt" (green/red) or muted "Nog niet beoordeeld".
4. **Warnings**: amber bars (`rounded-xl bg-amber-500/12 text-amber-700 dark:text-amber-300`, triangle icon) for
   "Controleer de code en tijd met de foto." and "Zelfde code als hunt van X".
5. **Actions**: Beheer `Pill`/`IconPill` (rounded 12px), left to right: "Foto" (download, disabled until loaded),
   "Bewerken" (admin; active = primary-soft), re-read IconPill (admin, spins while reading), delete IconPill
   `danger-soft` (admin, only while not submitted and no site result). Right: primary Pill "Ingestuurd" (admin, when
   to submit/overdue) or secondary "Terugzetten" (admin, submitted and not judged). Delete replaces the row with
   `InlineConfirm` ("Hunt {code} verwijderen?" / "De foto wordt ook verwijderd.") via the row's `confirm` prop.

Non-admins see the photo, facts and warnings and only the "Foto" download.

## Opening on a hunt

`HuntsSection` passes `initialReportId` as today. The window opens on "Alles" with that row open and scrolled into view
(`scrollIntoView({ block: 'nearest' })` after the reveal). If paging would hide it, raise the visible count to include it.

## Removed

- `HuntDetail.tsx` and the detail branch in `AllHuntsDialog` (header hiding, back button, `p-0` switch).
- The table (`Table*`), the ToggleGroup filter, the totals chips strip.
- `HuntStatusBadge.tsx` (only used by the dialog and the detail).

## Motion

Everything animates (see the animations rule): filter/area changes `SWAP`; row open/close `Reveal` + chevron;
status text changes (e.g. after "Ingestuurd") cross-fade (`FadeSwap`); confirm swap via `BeheerExpandableRow`; delete
lets the row fold out (`AnimatePresence` on the rows); phone list↔pane slide; lightbox fade + scale. Respect
`prefers-reduced-motion`.

## Testing

- Unit: the meta status text/tone helper (all statuses, review/duplicate suffix, website-only) and the filter/area
  counts.
- Component: opening with `initialReportId` opens that row; delete confirm flow; "Ingestuurd" calls the existing
  mutation; non-admin sees no admin actions.
- Manual in the preview (dark + light, desktop + phone width): countdown ticks, pulse in last 5 min, lightbox, edit.

## Out of scope

Sidebar hunt cards (`HuntReportRow`), server/API changes, the hunt registration flow.
