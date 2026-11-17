/** How long a focus request waits for its popup to mount (the layer opens it on its next render). */
export const POPUP_FOCUS_REQUEST_MS = 1000;

let requestedAt = Number.NEGATIVE_INFINITY;

/** The next map popup that mounts takes focus (a keyboard user opened it from a list, see openLayerFeature). */
export function requestPopupFocus(now = Date.now()) {
  requestedAt = now;
}

/** Whether a popup mounting now should take focus. Idempotent (StrictMode renders twice); the popup clears it. */
export function popupFocusRequested(now = Date.now()): boolean {
  return now - requestedAt < POPUP_FOCUS_REQUEST_MS;
}

export function clearPopupFocusRequest() {
  requestedAt = Number.NEGATIVE_INFINITY;
}
