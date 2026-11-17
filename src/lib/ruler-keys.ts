/**
 * Keyboard measuring with the ruler (desktop, the map focused), like drawing a night area (lib/night-draw-keys.ts):
 * Enter drops a point in the middle of the map, the arrow keys nudge the last point (Shift: further), Backspace takes
 * the last point away, Escape switches the ruler off. What happens is read out through a live region.
 */
import { distanceMetres } from './own-position';
import { formatDistance } from './tracker';

/** Read out when the ruler switches on */
export const RULER_ON_MESSAGE = 'Liniaal aan. Enter zet een punt in het midden van de kaart, pijltjes verschuiven het laatste punt, Backspace haalt het weg, Escape stopt.';
export const RULER_OFF_MESSAGE = 'Liniaal uit.';

/** Length of the measured line in metres, along the points ([lng, lat], the ruler's order) */
export function rulerTotalMetres(points: readonly (readonly [number, number])[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distanceMetres({ lng: points[i - 1][0], lat: points[i - 1][1] }, { lng: points[i][0], lat: points[i][1] });
  }
  return total;
}

/** Read out after Enter dropped point number `count` (1-based): from the second point on with the total so far */
export function rulerDroppedMessage(count: number, totalMetres: number): string {
  return count < 2 ? 'Punt 1 gezet. Pijltjes verschuiven het, Enter zet het volgende.' : `Punt ${count} gezet, totaal ${formatDistance(totalMetres)}.`;
}

/** Read out after Backspace took the last point away; `left` points remain */
export function rulerUndoMessage(left: number, totalMetres: number): string {
  if (left === 0) return 'Laatste punt weggehaald, geen punten meer.';
  return left === 1 ? 'Laatste punt weggehaald, nog 1 punt.' : `Laatste punt weggehaald, totaal ${formatDistance(totalMetres)}.`;
}
