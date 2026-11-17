/**
 * One half of the joined tonal button group in the sidebar header (theme + settings); the caller sets the corners.
 * Phones: a 44px-tall hit area (::after, vertical only so the two halves don't overlap).
 */
export const HEADER_BUTTON =
  'relative grid h-8 w-[34px] max-md:after:absolute max-md:after:-inset-y-1.5 max-md:after:inset-x-0 shrink-0 cursor-pointer place-items-center bg-beheer-row text-foreground outline-none transition-[background-color,color,border-radius] duration-200 hover:bg-beheer-row-high focus-visible:ring-[3px] focus-visible:ring-ring motion-reduce:transition-none';
