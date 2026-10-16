/**
 * The look of every dropdown, select and popover: the settings menu card with tonal rows
 * (docs/superpowers/specs/2026-10-17-dropdowns-redesign-design.md). The shared ui primitives use these as defaults.
 */

/** Card: 24px corners, hairline + soft shadow instead of a border. Add the padding (p-3 menus, p-4 popovers). */
export const MENU_SURFACE = 'rounded-3xl border-0 bg-card text-card-foreground shadow-[0_0_0_1px_var(--border),0_10px_30px_rgb(0_0_0/0.28)]';

/** Radix enter/exit: fade + zoom from 95% + a 2px slide away from the trigger. */
export const MENU_MOTION =
  'duration-200 ease-out data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95';

/** Rows sit in a column with 2px seams; first/last rows round to 16px. */
export const MENU_GROUP = 'flex flex-col gap-0.5';

/** Tonal row, 6px corners and 16px on the outer ends of its group. */
export const MENU_ROW_BASE =
  "relative flex cursor-default items-center gap-2.5 rounded-md bg-beheer-row px-3 py-2.5 text-[13.5px] font-semibold outline-hidden select-none transition-colors duration-150 first:rounded-t-2xl last:rounded-b-2xl focus:bg-beheer-row-high data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground";

/** The chosen radio / select row: soft orange, icons included. */
export const MENU_ROW_CHECKED = 'data-[state=checked]:bg-(--map-selected-bg) data-[state=checked]:text-(--map-selected-fg) data-[state=checked]:[&_svg]:text-(--map-selected-fg)!';

/** Small header above a group of rows. */
export const MENU_LABEL = 'px-1 pt-1 pb-1.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase';

/** Any button that opens a dropdown or popover: soft orange while open, its `data-chevron` icon turns. */
export const TRIGGER_OPEN =
  'data-[state=open]:bg-(--map-selected-bg) data-[state=open]:text-(--map-selected-fg) data-[state=open]:hover:bg-(--map-selected-bg) [&_svg]:transition-colors [&_[data-chevron]]:transition-[transform,color] [&_[data-chevron]]:duration-200 data-[state=open]:[&_[data-chevron]]:rotate-180 data-[state=open]:[&_svg]:text-(--map-selected-fg)';
