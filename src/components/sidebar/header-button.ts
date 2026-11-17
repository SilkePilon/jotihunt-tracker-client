/**
 * One button of the joined tonal group in the sidebar header (laptop: Intel, theme, settings; phones: theme, settings);
 * the caller sets the corners and adds HEADER_BUTTON_START or HEADER_BUTTON_END to the outer ones. Touch: a 44×44 hit
 * area (::after) — 6px above and below, and the 10px extra width only outward (left of the first button, right of the
 * last), so neighbours never overlap.
 */
export const HEADER_BUTTON =
  'relative grid h-8 w-[34px] pointer-coarse:after:absolute pointer-coarse:after:-inset-y-1.5 pointer-coarse:after:left-0 pointer-coarse:after:right-0 pointer-coarse:after:content-[\'\'] shrink-0 cursor-pointer place-items-center bg-beheer-row text-foreground outline-none transition-[background-color,color,border-radius] duration-200 hover:bg-beheer-row-high focus-visible:ring-[3px] focus-visible:ring-ring motion-reduce:transition-none';

/** The group's left half: its touch area grows to the left (over the header's 8px gap, nothing interactive there) */
export const HEADER_BUTTON_START = 'pointer-coarse:after:-left-2.5';

/** The group's right half: its touch area grows to the right (into the header card's 12px padding) */
export const HEADER_BUTTON_END = 'pointer-coarse:after:-right-2.5';
