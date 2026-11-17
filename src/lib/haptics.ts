/** Length of the confirm tick in ms: a short, light tap, like Android's own confirm feedback */
export const CONFIRM_HAPTIC_MS = 10;

/**
 * A short vibration that confirms a deliberate action went through (a completed hold, a registered Hunt/Spot). Feature
 * detected: iOS Safari and desktops have no vibrate, and a browser may refuse it (no user activation yet); never throws.
 */
export function confirmHaptic(nav: { vibrate?: (pattern: number) => boolean } | undefined = typeof navigator === 'undefined' ? undefined : navigator): void {
  try {
    nav?.vibrate?.(CONFIRM_HAPTIC_MS);
  } catch {
    // No haptics: nothing to show instead (the UI already confirms visually)
  }
}
