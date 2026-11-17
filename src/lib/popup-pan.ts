/** Box (px) on the desktop map a popup must stay inside: right of the sidebar, below the top bar, left of the controls. */
export interface SafeBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const DESKTOP_POPUP_SAFE: SafeBox = { left: 336, top: 60, right: 60, bottom: 16 };

/**
 * How far to pan the map ([x, y] for map.panBy) so a popup at `rect` (px in the map container) fits inside the
 * container minus `safe`. [0, 0] when it already fits. A popup larger than the box keeps its left/top edge in view.
 */
export function popupPan(rect: { left: number; top: number; width: number; height: number }, container: { width: number; height: number }, safe: SafeBox = DESKTOP_POPUP_SAFE): [number, number] {
  const axis = (start: number, size: number, min: number, max: number) => {
    if (start < min) return start - min;
    // Past the far edge: pan by the overflow, but never so far that the near edge goes out of view
    if (start + size > max) return Math.min(start + size - max, start - min);
    return 0;
  };
  const x = axis(rect.left, rect.width, safe.left, container.width - safe.right);
  const y = axis(rect.top, rect.height, safe.top, container.height - safe.bottom);
  // Avoid -0 (and sub-pixel nudges)
  return [Math.round(x) || 0, Math.round(y) || 0];
}
