/** Pixel ratio the map marker images are drawn at: the screen's, rounded, at most 3. */
export function mapImagePixelRatio(): number {
  return Math.min(3, Math.max(1, Math.round(window.devicePixelRatio || 1)));
}
