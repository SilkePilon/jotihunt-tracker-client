/**
 * Text field look (Beheer settings, Koppelingen panels, auth pages): tonal row-high fill, 8px corners, a hairline inset ring
 * instead of a border, 16px text on phones (no iOS zoom) and 13px on desktop. ui/input and ui/textarea use it as their
 * default; pass extra classes to Input's className.
 */
export const TONAL_FIELD =
  'rounded-lg border-0 bg-beheer-row-high text-base shadow-[inset_0_0_0_1px_var(--input)] md:text-[13px] dark:bg-beheer-row-high';
