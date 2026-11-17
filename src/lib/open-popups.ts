/**
 * How many map popups (floating on desktop, docked on phones) are open right now. A map tap while one is open only
 * closes it; the next tap picks a location ("Gekozen locatie"), like tapping away a dialog.
 */
let openCount = 0;

/** Count a popup as open until the returned function is called (once; later calls do nothing). */
export function trackOpenPopup(): () => void {
  openCount += 1;
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    openCount -= 1;
  };
}

/** Whether any map popup is open. */
export function isMapPopupOpen(): boolean {
  return openCount > 0;
}
