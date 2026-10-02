import { expect, test } from 'bun:test';
import { isIos, needsIosInstall, urlBase64ToUint8Array } from './push';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36';

test('iOS needs the app on the home screen for push', () => {
  expect(isIos(IPHONE)).toBe(true);
  expect(isIos(ANDROID)).toBe(false);
  expect(needsIosInstall(IPHONE, false)).toBe(true);
  expect(needsIosInstall(IPHONE, true)).toBe(false);
  expect(needsIosInstall(ANDROID, false)).toBe(false);
});

test('urlBase64ToUint8Array decodes url-safe base64', () => {
  expect([...urlBase64ToUint8Array('AQID_-8')]).toEqual([1, 2, 3, 255, 239]);
});
