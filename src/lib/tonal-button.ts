/** Hover of every grey tonal (bg-beheer-row-high) control: 14% foreground into the card, one step everywhere (a /70
 * lighten-on-hover faded the control into the card). */
export const TONAL_HOVER = 'hover:bg-[color-mix(in_oklab,var(--foreground)_14%,var(--card))]';

/** The same hover again under dark:, for a Button whose variant brings its own dark:hover (ghost). Not on dropdown
 * triggers: it would outrank TRIGGER_OPEN's open hover in dark mode. */
export const TONAL_HOVER_DARK = 'dark:hover:bg-[color-mix(in_oklab,var(--foreground)_14%,var(--card))]';

/** Sidebar button styles (sidebar option B): grey tonal and soft orange, 12px corners, no border. Pass to Button's className. */
export const TONAL_BUTTON = `h-9 rounded-xl border-0 bg-beheer-row-high text-foreground shadow-none transition-colors ${TONAL_HOVER} hover:text-foreground dark:bg-beheer-row-high ${TONAL_HOVER_DARK}`;

export const SOFT_PRIMARY_BUTTON =
  'h-9 rounded-xl bg-primary-container text-on-primary-container shadow-none transition-colors hover:bg-[color-mix(in_oklab,var(--on-primary-container)_10%,var(--primary-container))]';
