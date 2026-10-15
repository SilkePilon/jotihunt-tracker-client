# Hint registreren card redesign — design

Date: 2026-10-16
Status: approved (visual companion pick **C + M2**, mockup `.superpowers/brainstorm/204250-1792102261/content/hint-entry-dropdowns.html`)

## Goal

The sidebar "Hint registreren" card (`src/components/cards/hint-entry/HintEntryCard.tsx`) still uses stock shadcn
selects, outlined OTP slots and trash buttons. Bring it in line with the newer cards (Beheer, settings menu, map
layers popover): one tonal block, custom pickers in the menu-card style, lucide icons, animated state changes.

Behaviour stays the same: validation, `createMarker`, toasts, `flyTo` after success, the hint bridge (map pick fills
X/Y) and the mobile menu page (it renders the same card).

## Layout

```
┌ Hint registreren                         ˄ ┐   ← existing SidebarSection header
│ ┌───────────────────────────────────────┐ │
│ │ [● Alpha        ⌄] [🕑 za 14:00     ⌄] │ │   ← two picker triggers (bg-card on tonal block)
│ │ X [1][5][5][0][0][0]                   │ │
│ │ Y [4][6][3][0][0][0]                   │ │   ← digit boxes
│ │ ✓ Ligt in Nederland          ⌫ Wissen  │ │   ← status line + clear-all link
│ └───────────────────────────────────────┘ │
│ [            📍 Registreren              ] │   ← primary button, rounded-lg (12px)
└───────────────────────────────────────────┘
```
(Glyphs above are placeholders for lucide icons, see Icons.)

- Tonal block: `rounded-[20px] bg-beheer-row p-3.5`.
- Triggers: `h-10 rounded-lg bg-card`, flex-1 each, 6px gap. Hover `bg-beheer-row-high`; open = 2px inset primary ring;
  chevron rotates 180° when open. Placeholder text muted ("Gebied", "Tijd").
- Area trigger leads with the area colour dot (`getColorFromArea`), border-colour dot when empty. No icon.
- Time trigger leads with lucide `Clock`; label `za 14:00` (short weekday + hour). Disabled (45% opacity) until an
  area is chosen.

## Pickers (M2)

Both are a `Popover` (`src/components/ui/popover.tsx`) styled with `MENU_CARD` from `settings/menu-parts.tsx`
(rounded-3xl card, border shadow), padding 10px, scale/fade-in from the trigger corner (area: top-left, time:
top-right). Esc / outside click closes. Keyboard: tiles are buttons, arrow-key roving not required.

**AreaPicker** — 3×3 grid of tiles (`h-11 rounded-[14px] bg-beheer-row`, colour dot + name, 13px semibold).
Selected tile: orange tonal fill (`bg-primary-container text-on-primary-container`, new tokens, see Tokens) + 2px primary inset ring. Picking closes the popover
and opens the time picker (~200ms after the close starts).

**TimePicker** — segmented day switch on top (one segment per calendar day in the hunt, labelled with the full
weekday, e.g. Zaterdag / Zondag; Beheer segmented radii 12/4), below it a 4-column grid of hour tiles (`h-[38px]`,
tabular nums) for the selected day. Taken hours (hint already registered for that area at that hour) render crossed
out at 35% opacity and are not clickable (tooltip/title "Al geregistreerd"). Selected hour = same orange tonal fill.
Default day = the day of the latest free hour (during the hunt that's "now"). Empty state (no hours yet):
muted text "(Nog) geen tijdstip te kiezen". Picking closes the popover and focuses X.

Changing the area keeps the chosen time if it's still free for the new area, else clears it.

## Digit boxes

Keep `InputOTP` (paste, mobile keyboard, focus handling stay as is); restyle the slots only:
- 6 slots per axis filling the row (`grid` 20px axis label + 6×1fr, 4px gaps), `h-[46px] rounded-[10px] bg-card`,
  22px semibold mono, no border.
- Active slot: 2px primary inset ring. Filled: orange tonal fill. Outside NL / invalid: all filled slots red tonal
  (`--fox-error-container` / `--fox-on-error-container`).
- Focus flow unchanged: X complete → Y, Y complete → Registreren.
- Trash buttons removed. "Wissen" link (lucide `Eraser`, primary text, 12px semibold) in the status line clears X and Y.

## Status line

Under the digits, left side, 12px, icon + text, colour transitions:
- idle: `Keyboard` icon, muted, "Tik op de vakjes om te typen"
- in NL: `CircleCheck`, `--fox-ok`, "Ligt in Nederland"
- outside NL: `TriangleAlert`, `--fox-error`, "Buiten Nederland"

Replaces the current red `<p role="alert">` paragraph; keep `role="status"`/`aria-live="polite"` on the line.

## Tokens

Add to `src/index.css` (light / dark) and expose in `@theme inline` as `--color-primary-container` /
`--color-on-primary-container`:
- light: `--primary-container: #ffdcc6; --on-primary-container: #5a1f00;`
- dark: `--primary-container: #6b2b05; --on-primary-container: #ffdcc6;`

## Icons (lucide-react)

`ChevronDown` (triggers), `Clock` (time trigger), `Eraser` (Wissen), `CircleCheck` / `TriangleAlert` / `Keyboard`
(status), `Pin` (Registreren button, unchanged). No emojis anywhere.

## Animation (motion/react)

Popover open/close scale+fade; selected tile fill colour transition; slot colour transitions; status icon/text swap
with `AnimatePresence` (fade/slide 4px); button label stays. Disabled → enabled triggers fade opacity.

## Code structure

- `src/components/cards/hint-entry/HintEntryCard.tsx` — form, layout, digit rows, status line, submit.
- `src/components/cards/hint-entry/AreaPicker.tsx` — trigger + popover grid. Props: `value`, `onChange`, `invalid`.
- `src/components/cards/hint-entry/TimePicker.tsx` — trigger + popover day switch + hour grid. Props: `value`,
  `onChange`, `days` (from helper), `disabled`, `open`, `onOpenChange` (controlled so AreaPicker can open it).
- `src/components/cards/hint-entry/hint-times.ts` — pure helpers, replacing `getTimeOptions`:
  - `buildHintHours(start, end, now, markers, area)` → `{ value: ISO, label: 'HH:00', day: 'YYYY-MM-DD', taken }[]`
    (keeps taken hours instead of removing them).
  - `groupByDay(hours)` → `{ key, label: 'Zaterdag', hours }[]`.
  - `defaultDay(groups)` → key of the day holding the latest free hour.
  - `shortLabel(iso)` → `za 14:00`.
- `hint-times.test.ts` — bun tests for the helpers (taken detection per area/hour, end clamped to now, grouping
  across midnight, default day, empty).

## Out of scope

Map-pick flow, server, mobile menu shell, other cards.

## Testing

- bun tests for `hint-times.ts`.
- Manual in preview, light + dark, sidebar + phone width: pick area → time opens → pick hour → X focused; taken hours
  not clickable; type Utrecht (155000/463000) → green; X 300000 → red slots + disabled button; Wissen; map pick fills
  X/Y; successful submit resets form and flies to the hint.
