import { afterEach, describe, expect, test } from 'bun:test';
import { clearPopupFocusRequest, POPUP_FOCUS_REQUEST_MS, popupFocusRequested, requestPopupFocus } from './popup-focus';

describe('popup focus request', () => {
  afterEach(clearPopupFocusRequest);

  test('nothing requested by default', () => {
    expect(popupFocusRequested(1000)).toBe(false);
  });

  test('a request holds for a short while, then lapses', () => {
    requestPopupFocus(1000);
    expect(popupFocusRequested(1000)).toBe(true);
    expect(popupFocusRequested(1000 + POPUP_FOCUS_REQUEST_MS - 1)).toBe(true);
    expect(popupFocusRequested(1000 + POPUP_FOCUS_REQUEST_MS)).toBe(false);
  });

  test('reading does not consume it; clearing does', () => {
    requestPopupFocus(1000);
    expect(popupFocusRequested(1001)).toBe(true);
    expect(popupFocusRequested(1002)).toBe(true);
    clearPopupFocusRequest();
    expect(popupFocusRequested(1003)).toBe(false);
  });
});
