/**
 * Keyboard drawing of a night area (NightAreaDraw), with the map focused: Enter drops a corner in the middle of the map,
 * the arrow keys nudge the last corner (Shift: further), Enter again on a corner that hasn't moved closes the ring (the
 * keyboard's double tap), Backspace takes the last corner away.
 */

/** Nudge step in screen px; Shift moves five times as far */
export const NUDGE_PX = 10;
const FAST = 5;

/** Screen-px move [dx, dy] for an arrow key, or null for any other key. */
export function nudgeDelta(key: string, shift: boolean): [number, number] | null {
  const step = shift ? NUDGE_PX * FAST : NUDGE_PX;
  switch (key) {
    case 'ArrowLeft':
      return [-step, 0];
    case 'ArrowRight':
      return [step, 0];
    case 'ArrowUp':
      return [0, -step];
    case 'ArrowDown':
      return [0, step];
    default:
      return null;
  }
}

/** The hint pill while the map has keyboard focus */
export const KEYBOARD_DRAW_HINT = 'Enter: punt in het midden · pijltjes: verschuiven · 2× Enter: sluiten';

/** Read out after Enter dropped corner number `count` (1-based) */
export function droppedMessage(count: number): string {
  const next = count >= 3 ? 'Enter zet het volgende punt, nog eens Enter sluit het gebied.' : 'Enter zet het volgende punt.';
  return `Punt ${count} gezet. Pijltjes verschuiven het. ${next}`;
}

export const CLOSED_MESSAGE = 'Gebied gesloten. Geef het een naam.';
export const MOVE_FIRST_MESSAGE = 'Verschuif dit punt eerst met de pijltjes, het gebied heeft minstens 3 punten nodig.';
export const UNDO_MESSAGE = 'Laatste punt weggehaald.';
