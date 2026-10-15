# Meldingen dialog redesign

Date: 2026-10-16
Mockups: `.superpowers/brainstorm/235574-1792103358/content/meldingen.html` (options A/B/C, picked **B**) and
`meldingen-b-v2.html` (B with sidebar-style buttons, approved).

## Problem

`NotificationsDialog` is stock shadcn: a list of label + description rows with small shadcn switches, outline/primary
`sm` buttons and the default square close icon. The rest of the app (Beheer, settings menu, layers popover, QR drawer,
Android popup) uses tonal fills without borders, 12px button radii, M3 switches and rounded cards.

## Design (B: tiles)

Same `ResponsiveDialog`, store, prefs hook and save / close / push-subscribe logic. Only the content and styling change.

### Shell

- Desktop: `className` keeps `sm:max-w-sm` and adds a 28px radius (`rounded-[28px]`), `bg-card`, no border, and the layers
  popover shadow (`0 0 0 1px var(--border), 0 10px 30px rgb(0 0 0/.28)`).
- Close button: restyled from the dialog via a `[&>[data-slot=dialog-close]]` selector in that `className`: 34×32,
  `rounded-xl` (12px), `bg-beheer-row`, hover `bg-beheer-row-high`, muted icon, full opacity, no offset ring
  (focus-visible ring like the header buttons). Same shape as the sidebar header buttons.
- Phone: same content in the existing bottom drawer.
- Description text becomes "Tik aan waarvoor je een melding en geluid wilt."

### Content, top to bottom

1. **Alles row**: `rounded-2xl bg-beheer-row px-3.5 py-3`, "Alles" (14px semibold) left, muted counter "N van 6"
   (12px semibold), `BeheerSwitch` right. Checked only when every optional type is on. Turning it on clears
   `disabledTypes`; turning it off disables all six. The whole row is the switch's label (click anywhere toggles).
2. **Tile grid**: 2 columns, 6px gap. Each tile is a `<button type="button" aria-pressed>`, `rounded-2xl`, p-3,
   min-height ~104px, left aligned: 20px lucide icon, label (13px semibold), short text (11px, 80% opacity).
   - On: `--map-selected-bg` / `--map-selected-fg`, a 20px `bg-primary` check badge top right (white `CheckIcon`, 12px).
   - Off: `bg-beheer-row`, muted icon and short text, label in foreground; hover `bg-beheer-row-high`. Badge gone.
   - Fill/colour transition 200ms; the badge pops in/out with motion/react (`AnimatePresence`, scale 0.3 + fade,
     emphasized easing), respecting reduced motion.
   - The long `description` is kept as the button's `title` and in an `sr-only` span, so nothing is lost.
3. **HQ note**: `rounded-[14px] border border-dashed`, muted 12px text with `MegaphoneIcon`:
   "Berichten van HQ krijg je altijd."
4. **Notices** (iOS install hint, push blocked): same texts as today, restyled as `rounded-2xl bg-beheer-row p-3
   text-xs`; they animate in/out (height + fade) with motion/react.
5. **Buttons**: one row, each `flex-1 h-11 rounded-xl text-[14px] font-semibold`. "Later" = `bg-beheer-row-high`
   (hover a step darker), "Opslaan" = `bg-primary text-primary-foreground`, disabled while saving / no prefs.
   Matches the Android popup and QR drawer buttons.

### Data

`NOTIFICATION_OPTIONS` in `src/lib/notifications.ts` gets a `short` field:

| type | icon | short |
|---|---|---|
| fox-status | `FlagIcon` | Rood, oranje of groen |
| hint | `LightbulbIcon` | Zodra hij er is |
| article | `NewspaperIcon` | Nieuwe berichten |
| hunt-deadline | `TimerIcon` | 10 min van tevoren |
| counter-hunt | `SwordsIcon` | Met richting |
| happy-hour | `PartyPopperIcon` | Hunts tellen dubbel |

Icons live in the component as a `Record<OptionalNotificationType, LucideIcon>`, so `lib/notifications.ts` stays free of
React.

### Scope

- Only `NotificationsDialog.tsx` and `lib/notifications.ts` (the `short` field). No changes to prefs, push, server,
  prompt version, or `ResponsiveDialog`.
- Light and dark use the same tokens.

## Testing

- Typecheck, lint, existing tests.
- Visual check in the browser, light and dark, desktop and phone width: tile toggle + badge animation, Alles on/off
  and the counter, keyboard toggling of tiles, close button look, Later / Opslaan (toast + push subscribe), iOS / blocked
  notices.
