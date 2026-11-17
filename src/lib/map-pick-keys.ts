/**
 * Picking a location from the keyboard (the map focused, no ruler or night-area drawing): Enter opens the "Gekozen
 * locatie" card for the middle of the map, where the centre crosshair sits. Read out through a live region.
 */

/** Read out after Enter picked the middle of the map */
export const PICK_MESSAGE = 'Gekozen locatie in het midden van de kaart geopend.';

/** Whether a key press on the focused map picks its centre: a plain Enter (no modifiers, not held down) */
export function isPickKey(event: { key: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; repeat: boolean }): boolean {
  return event.key === 'Enter' && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.repeat;
}
