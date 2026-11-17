/** Zoom and pan of the photo lightbox (ImageLightbox). */
export type LightboxView = { scale: number; x: number; y: number };

export const LIGHTBOX_START: LightboxView = { scale: 1, x: 0, y: 0 };
export const LIGHTBOX_MIN_SCALE = 1;
export const LIGHTBOX_MAX_SCALE = 6;
/** Zoom factor of the +/- buttons and keys */
export const LIGHTBOX_STEP = 1.4;
/** Pixels an arrow key pans a zoomed photo */
export const LIGHTBOX_PAN = 40;

const clampScale = (scale: number) => Math.min(LIGHTBOX_MAX_SCALE, Math.max(LIGHTBOX_MIN_SCALE, scale));

/** Zoom by `factor`, clamped; back at 1× the pan resets too. */
export function zoomView(view: LightboxView, factor: number): LightboxView {
  const scale = clampScale(view.scale * factor);
  return scale === 1 ? LIGHTBOX_START : { ...view, scale };
}

const PAN: Record<string, [number, number]> = {
  ArrowLeft: [LIGHTBOX_PAN, 0],
  ArrowRight: [-LIGHTBOX_PAN, 0],
  ArrowUp: [0, LIGHTBOX_PAN],
  ArrowDown: [0, -LIGHTBOX_PAN],
};

/**
 * The view after a key on the photo: + / = zoom in, - zoom out, 0 resets, arrows pan (only when zoomed in; the arrow
 * moves the view that way, so the photo shifts the other way). null: the key is not ours.
 */
export function lightboxKey(view: LightboxView, key: string): LightboxView | null {
  if (key === '+' || key === '=') return zoomView(view, LIGHTBOX_STEP);
  if (key === '-' || key === '_') return zoomView(view, 1 / LIGHTBOX_STEP);
  if (key === '0') return LIGHTBOX_START;
  const pan = PAN[key];
  if (!pan) return null;
  if (view.scale <= 1) return view;
  return { ...view, x: view.x + pan[0], y: view.y + pan[1] };
}
