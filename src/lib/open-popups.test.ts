import { describe, expect, test } from 'bun:test';
import { isMapPopupOpen, trackOpenPopup } from './open-popups';

describe('open map popups', () => {
  test('open while at least one popup is tracked', () => {
    expect(isMapPopupOpen()).toBe(false);
    const closeA = trackOpenPopup();
    const closeB = trackOpenPopup();
    expect(isMapPopupOpen()).toBe(true);
    closeA();
    expect(isMapPopupOpen()).toBe(true);
    closeB();
    expect(isMapPopupOpen()).toBe(false);
  });

  test('closing twice counts once (StrictMode cleanups, a swap racing an unmount)', () => {
    const closeA = trackOpenPopup();
    const closeB = trackOpenPopup();
    closeA();
    closeA();
    expect(isMapPopupOpen()).toBe(true);
    closeB();
    expect(isMapPopupOpen()).toBe(false);
  });
});
