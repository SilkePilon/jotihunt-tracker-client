import { describe, expect, test } from 'bun:test';
import { swrKeyFor, telegramAdminRefreshInterval, TELEGRAM_VIEW_PATHS } from './telegram';

test('telegramAdminRefreshInterval: 2 s while linking, 30 s while linked, else off', () => {
  expect(telegramAdminRefreshInterval({ state: 'qr' })).toBe(2000);
  expect(telegramAdminRefreshInterval({ state: 'password' })).toBe(2000);
  expect(telegramAdminRefreshInterval({ state: 'linked' })).toBe(30_000);
  expect(telegramAdminRefreshInterval({ state: 'unavailable' })).toBe(0);
  expect(telegramAdminRefreshInterval({ state: 'unlinked' })).toBe(0);
  expect(telegramAdminRefreshInterval(undefined)).toBe(0);
});

describe('swrKeyFor', () => {
  const matches = swrKeyFor(TELEGRAM_VIEW_PATHS);

  test('matches useAuthSWR keys by path, ignoring the query string', () => {
    expect(matches(['/counter-hunt', 'Bearer x'])).toBe(true);
    expect(matches(['/telegram/messages?limit=50', 'Bearer x'])).toBe(true);
  });

  test('ignores other keys', () => {
    expect(matches(['/markers', 'Bearer x'])).toBe(false);
    expect(matches('/counter-hunt')).toBe(false);
    expect(matches(undefined)).toBe(false);
  });
});
