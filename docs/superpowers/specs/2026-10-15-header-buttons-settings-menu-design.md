# Header buttons + settings menu redesign

Date: 2026-10-15
Mockups: `.superpowers/brainstorm/103612-1792098779/content/header-buttons.html` (option B) and `settings-menu-v2.html` (M3 v2).

## Problem

The theme toggle and settings button in `SidebarHeader` are stock shadcn `outline` buttons (border + shadow, old `CogIcon`).
The settings dropdown is the stock shadcn menu. The rest of the app (Beheer, map layers popover, fox card) uses tonal
fills without borders, 12px radii, M3-style switches and rounded-3xl cards. These two pieces don't match.

## Design

### Header buttons (B: joined tonal group)

- `ThemeToggle` and the settings trigger render as one group: two 34×32 buttons, 2px gap, `--beheer-row` fill, hover
  `--beheer-row-high`, no border or shadow. Outer corners 12px, inner corners 6px (Beheer segmented radii).
- Theme icon: `MoonStarIcon` in light mode, `SunIcon` in dark mode. Both stay mounted and cross-swap with rotate (±90°) +
  scale (0.4) + fade, ~350ms, emphasized easing. Labels unchanged ("Donkere modus" / "Lichte modus").
- Settings icon: `Settings2Icon` (sliders), 18px.
- While the menu is open the settings half gets the selected fill (`--map-selected-bg` / `--map-selected-fg`, light
  orange) and animates to 12px on all corners.
- The group is a small shared wrapper in `SidebarHeader`; `ThemeToggle` and `Settings` receive the corner classes so each
  stays its own component.

### Settings menu (M3 v2)

Same Radix `DropdownMenu`, same store (`useSettingsMenuStore`), same tour behaviour; only the content changes.

- Content: `rounded-3xl` card, `bg-card`, p-3, width ~290px, shadow like the layers popover
  (`0 0 0 1px var(--border), 0 10px 30px rgb(0 0 0/.28)`), open/close fade + scale from the trigger corner.
- No "Hoi, naam" label and no separators.
- **Tiles** (3-column grid, gap 6px, each a `DropdownMenuItem` so keyboard navigation keeps working; rounded-2xl,
  `--beheer-row`, icon 20px above an 11.5px semibold label):
  - **Geluid**: toggles `soundMuted`, menu stays open (`onSelect` preventDefault). On: selected fill, `Volume2Icon`,
    "Geluid aan". Off: tonal, `VolumeXIcon`, "Geluid uit". Fill and icon animate.
  - **Meldingen**: `BellIcon`, opens the notifications dialog.
  - **Rondleiding**: `CompassIcon`, closes the menu and replays the tour; carries the `settings.replayItem` tour target.
    Only rendered when `onReplayTour` is given (grid then shows two tiles).
- **Rows** (Beheer segmented list: 2px gaps, radii 16 outer / 6 inner, `--beheer-row`, hover `--beheer-row-high`,
  13.5px semibold, muted 16px icon), shown in this order when they apply:
  - Account (`UserRoundIcon`), right side muted "naam" plus " · Admin" for admins.
  - Installeer app (`DownloadIcon`) when not standalone and the prompt is supported.
  - Phones only: Zichtbare lagen and Kaartstijl as sub-triggers with a trailing chevron; their sub-content uses the
    same card style (rounded-3xl card, tonal rows, M3 switches instead of check marks for the layers).
  - Beheer (`ShieldIcon`) and Debug (`BugIcon`) for admins.
  - Join de Discord, only when `DISCORD_URL` is set (it is empty on production today).
- **Uitloggen**: its own one-row group 8px below, red text/icon on a red tonal fill (`--map-danger-fg` on `--map-danger-bg`), calls `logout`.

### Scope

- Desktop sidebar header and the phone menu (`MobileMenu` renders the same `SidebarHeader`).
- No behaviour changes beyond the Geluid tile being a toggle tile instead of a checkbox item.
- Dark mode uses the same tokens; all state changes animate (enter/exit, swap, open/close).

## Testing

- Typecheck + lint + existing tests.
- Visual check in the browser, light and dark, desktop and phone width: theme swap animation, menu open state on the
  trigger, Geluid toggle keeps the menu open, Rondleiding replays the tour (tour still points at the tile), phone
  submenus open and toggle layers/styles, admin-only rows hidden for non-admins, Uitloggen works.
