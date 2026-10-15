/**
 * Mobile viewport maths. With `interactive-widget=resizes-visual` the keyboard only shrinks the visual viewport;
 * the obscured strip at the bottom is innerHeight − (vv.height + vv.offsetTop). Small differences are browser
 * toolbars settling, not a keyboard.
 */
export const KEYBOARD_THRESHOLD = 60;

export function keyboardInset(innerHeight: number, vv: { height: number; offsetTop: number } | null): number {
  if (!vv) return 0;
  const inset = innerHeight - (vv.height + vv.offsetTop);
  return inset > KEYBOARD_THRESHOLD ? Math.round(inset) : 0;
}

export function visibleHeight(innerHeight: number, vv: { height: number } | null): number {
  return Math.round(vv ? vv.height : innerHeight);
}
