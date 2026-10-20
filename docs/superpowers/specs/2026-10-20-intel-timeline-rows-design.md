# Intel timeline rows — design

2026-10-20. Redesign of the Intel window's timeline list (`src/components/intel-window/IntelTimeline.tsx`). The current
list (time rail + one card per item with kind pill, status pills, area chips, orange unread dot, right-side status)
feels busy. Mockups: `.superpowers/brainstorm/117213-1792481724/content/` (picks: `tijdlijn-richting` A,
`tijdlijn-iconen` 1, `tijdlijn-hint-rij` A).

## Layout

- Day header stays (sticky, uppercase, muted), aligned with the group's left edge (no 66px rail indent).
- Per day **one tonal group card** (`bg-card`, 20px corners, `overflow-hidden`), items are rows separated by a 2px gap
  in the window colour — the Beheer D1 segmented-row look.
- The time rail (time column + line + kind dot) is removed; the time moves into the meta line.
- Row: 34×34 icon tile, then title (14px bold, one line, ellipsis) over one grey meta line (12px, one line, ellipsis).
  Nothing on the right side. Whole row is the button; hover = `bg-beheer-row`, focus-visible ring as now.

## Icon tile

- 12px corners, background `color-mix(KIND_COLOR 16%, card)`, lucide glyph in `KIND_COLOR`, 17px:
  news `MegaphoneIcon`, assignment `ClipboardListIcon`, hint `LightbulbIcon`.
- **Unread**: 9px dot in `foreground` colour at the top-right corner (−2px offset), 2.5px ring in the card colour.
  Replaces the orange `UnreadDot`.
- **Done**: `CookieBadge tone="ok" size={16} outline` at the bottom-right corner (−4px offset) when an assignment is
  judged by jotihunt.nl, or a hint has every relevant area solved (`solved === total`, total > 0).

## Meta line per kind

Segments joined by ` · `, all `text-muted-foreground` unless noted.

- **News**: `HH:MM · <summary>`.
- **Assignment, judged**: `HH:MM · Beoordeeld · <points>/<max> pt · <owner|niemand>`; the "Beoordeeld…" segment green
  (`text-green-500`/`dark:text-green-400`). No max → `<points> pt`; points null → `Beoordeeld`.
- **Assignment, not judged**: `HH:MM · <deadline> · <status label, only if not open> · <owner|niemand>`; deadline
  (`deadlineLabel`) only with an `endTime`, coloured by `deadlineTone`: calm = blue, urgent = amber, expired = red,
  done = muted.
- **Hint**: `HH:MM · <dots> <solved>/<total> opgelost`. Dots: one 6px dot per area in `areaOptions` order in the area
  colour; solved = filled, open = ring (1.4px inset shadow, 70% opacity), none/missing = ring at 30% opacity. Count
  text green when all solved.

The summary of a hint/assignment is no longer shown in the list (only news shows it).

## Removed from the list

Kind pill (`KindTag`), status/owner/max pills, the `AreaChip` row, the right-side "x/y opgelost" and deadline pill,
the orange unread dot. `KindTag`, `DeadlineTag` and `AssignmentStatusTag` stay exported for `IntelDetail` (detail
header is out of scope). `AreaChips.tsx` is deleted if nothing else uses it.

## Motion

- Unread dot and done badge: scale/opacity pop in and out (`REVEAL_TRANSITION`, `AnimatePresence initial={false}`);
  a done badge appearing while on screen uses `SuccessBadge` (as `AreaChip` does now), mounted-already-done uses the
  static `CookieBadge`.
- Area dot: fill transitions (background/box-shadow, 200 ms) plus a short scale pop when it becomes solved.
- Meta segments that change (status label, points, deadline tone) cross-fade (key on text, 0.15 s); colour eases.
- Existing list motion stays: entrance stagger, tab push, `Fold` unfold/fold of rows and days. Because rows now live
  inside a day card, the `Fold` per row sits inside the card so a new row unfolds within it.
- Reduced motion: as today (pushes become cross-fades); pops become fades.

## Theme

Only existing tokens (`card`, `beheer-window`, `beheer-row`, `muted-foreground`, `foreground`) plus `KIND_COLOR` and
area colours, so light mode follows automatically.

## Testing

- Unit-test any new pure helper in `src/lib/intel-window.ts` (e.g. `isHintDone`, a meta-segment builder) in
  `intel-window.test.ts`.
- Typecheck + lint + existing tests; visual check in the app (dark + light) with news, open/urgent/expired/judged
  assignments, partly and fully solved hints, unread items.
