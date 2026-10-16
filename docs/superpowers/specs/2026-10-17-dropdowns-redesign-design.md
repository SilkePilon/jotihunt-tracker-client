# Dropdowns redesign

Date: 2026-10-17. Mockups: `.superpowers/brainstorm/174578-1792190559/content/` (base-style A, life360 C).

## Goal

Every dropdown, select, menu and popover in the client uses the new theme (the header settings menu look). Today the
shared `ui/*` primitives still default to stock shadcn (`rounded-md border bg-popover shadow-md`, `focus:bg-accent`),
so any usage without overrides looks old. The Life360 members dropdown is also far too long (31 rows).

## Approach

Restyle the shared primitives themselves, so every current and future usage inherits the new look. Then delete the
per-usage overrides that only re-implemented parts of it.

## Base style (option A, "instellingen-kaart")

- **Content surface** (`DropdownMenuContent`, `DropdownMenuSubContent`, `SelectContent`, `PopoverContent`):
  `MENU_CARD` look: `rounded-3xl border-0 bg-card text-card-foreground` with the hairline ring and shadow
  `shadow-[0_0_0_1px_var(--border),0_10px_30px_rgb(0_0_0/0.28)]`. Padding `p-3` for menus/selects, `p-4` for popovers.
  Menu and select content lays rows out as `flex flex-col gap-0.5` (2px seams).
- **Rows** (`DropdownMenuItem`, `CheckboxItem`, `RadioItem`, `SubTrigger`, `SelectItem`): `MENU_ROW` look: tonal
  `bg-beheer-row`, `rounded-md` with `first:rounded-t-2xl last:rounded-b-2xl`, `px-3 py-2.5 text-[13.5px] font-semibold`,
  `focus:bg-beheer-row-high`, `transition-colors duration-150`. Labels and separators split groups; rows on either side
  of them get their own outer corners.
- **Selected state** (checked radio / select item; checkbox items only get the right-hand check): soft orange row `bg-(--map-selected-bg) text-(--map-selected-fg)`
  with a check icon on the right. The stock left indicator (dot / check, `pl-8`) is removed.
- **Destructive rows** (`variant="destructive"`): `--map-danger-bg/fg` tint.
- **Labels**: small muted uppercase header (`text-[11px] font-bold tracking-wide uppercase text-muted-foreground`).
- **Open trigger state (all dropdowns)**: the trigger turns soft orange while open
  (`data-[state=open]:bg-(--map-selected-bg) data-[state=open]:text-(--map-selected-fg)`), and its chevron rotates 180°.
  Applies to the `SelectTrigger` default and to every custom DropdownMenu/Popover trigger (Life360, vehicle, InvitesPane
  Picker, ModelPicker, SearchCard, AccountDialog ⋯, AreaPicker/TimePicker `PickerTrigger`).
- **SelectTrigger default**: tonal like Beheer's `FIELD` (`h-9 rounded-lg border-0 bg-beheer-row-high shadow-none`).
- **Command (cmdk) lists**: items get the same row/selected styling; input wrapper loses its border-b and becomes a
  tonal search field.
- **Motion**: enter/exit keep the tw-animate fade + zoom-95 + small slide, timing aligned with the settings menu. Value
  changes in triggers (vehicle label/icon, InvitesPane picker) use `SWAP` from `lib/motion.ts`.
- `components/settings/menu-parts.tsx` keeps its exports but builds on the new defaults (no duplicated classes).

## Life360 members dropdown (option C, "alleen live")

- **Trigger: unchanged** (same avatars, text "JOTIHUNT · 31 leden", chevron). Only addition: the orange open state.
- Content (`w-64`-ish, base style): header label "Live" with the count right-aligned. No green dot.
- Rows: only members currently sharing a location, sorted as today (`sortMembersForList`). Avatar 26px, name, age
  label right-aligned, **always muted gray** (no amber for stale). On hover/focus a small navigation arrow appears; select
  flies the map to the member (as today).
- Footer: muted line "+ N leden delen geen locatie" (hidden when N = 0).
- Empty states: loading → "Leden laden…"; nobody sharing → single disabled row "Niemand deelt nu locatie".

## Usages to touch

Fully old (inherit base, remove old bits): `cards/life360/Life360MembersMenu.tsx`, `tracker/VehicleMenu.tsx`,
`account/AccountDialog.tsx` ⋯ menu, `map/MarkerRegistration.tsx` selects, `layers/teams/TeamPopup.tsx` select,
`happy-hour/HappyHourPill.tsx` popover.

Mixed (drop overrides now covered by the base): `beheer/InvitesPane.tsx`, `intel-window/AssignmentPane.tsx`,
`beheer/GeneralSettings.tsx`, `beheer/ModelPicker.tsx`, `cards/search/SearchCard.tsx`.

Already new (verify unchanged look, simplify): `Settings.tsx`, `settings/LayersSubmenu.tsx`,
`settings/MapStyleSubmenu.tsx`, `map/MapLayersControl.tsx`, `hint-entry/AreaPicker.tsx`, `hint-entry/TimePicker.tsx`.
`android-promo/DownloadSplitButton.tsx` (custom, non-Radix) gets the orange open state only.

## Testing

- `tsc -b` and existing tests pass.
- Visual check in light + dark of each usage above (open, hover, selected, destructive, empty states).
- Life360: 0 sharing, some sharing, all sharing; footer count correct.
