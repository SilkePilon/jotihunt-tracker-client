import { describe, expect, test } from 'bun:test';
import { IOS_INSTALL_EXIT_MS, iosInstallDue, iosInstallExitMs, isIosBrowser, parseIosInstallVisits, type IosInstallEnv } from './pwa-install';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';

const env = (overrides: Partial<IosInstallEnv> = {}): IosInstallEnv => ({ userAgent: IPHONE, maxTouchPoints: 5, standalone: false, visits: 0, ...overrides });

describe('isIosBrowser', () => {
  test('iPhone, and an iPad that reports as a Mac (touch)', () => {
    expect(isIosBrowser(IPHONE, 5)).toBe(true);
    expect(isIosBrowser(MAC, 5)).toBe(true);
  });
  test('a real Mac or Android is not', () => {
    expect(isIosBrowser(MAC, 0)).toBe(false);
    expect(isIosBrowser(ANDROID, 5)).toBe(false);
  });
});

describe('iosInstallDue', () => {
  test('the first two times in Safari', () => {
    expect(iosInstallDue(env())).toBe(true);
    expect(iosInstallDue(env({ visits: 1 }))).toBe(true);
    expect(iosInstallDue(env({ visits: 2 }))).toBe(false);
  });
  test('not once installed, nor off iOS', () => {
    expect(iosInstallDue(env({ standalone: true }))).toBe(false);
    expect(iosInstallDue(env({ userAgent: ANDROID }))).toBe(false);
  });
});

test('parseIosInstallVisits', () => {
  expect(parseIosInstallVisits(null)).toBe(0);
  expect(parseIosInstallVisits('{"isValidOS":true,"visits":3}')).toBe(3);
  expect(parseIosInstallVisits('{"visits":"x"}')).toBe(0);
  expect(parseIosInstallVisits('not json')).toBe(0);
  expect(parseIosInstallVisits('null')).toBe(0);
});

describe('iosInstallExitMs', () => {
  test('waits for the slide-out, or unmounts at once without motion', () => {
    expect(iosInstallExitMs(false)).toBe(IOS_INSTALL_EXIT_MS);
    expect(IOS_INSTALL_EXIT_MS).toBeGreaterThanOrEqual(400);
    expect(iosInstallExitMs(true)).toBe(0);
  });
});
