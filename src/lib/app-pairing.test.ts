import { describe, expect, test } from 'bun:test';
import { absoluteUrl, buildPairingUrl, fetchLatestRelease, formatCountdown, formatPairingCode, secondsLeft } from './app-pairing';

describe('app pairing helpers', () => {
  test('pairing URL carries the absolute, encoded API base and the code', () => {
    expect(buildPairingUrl('https://api.example.nl/', 'ABCD2345', 'https://site.example.nl')).toBe(
      'jotihunt://pair?api=https%3A%2F%2Fapi.example.nl&code=ABCD2345',
    );
    expect(buildPairingUrl('/api', 'ABCD2345', 'https://site.example.nl')).toBe(
      'jotihunt://pair?api=https%3A%2F%2Fsite.example.nl%2Fapi&code=ABCD2345',
    );
  });

  test('absoluteUrl joins base and path', () => {
    expect(absoluteUrl('/api', '/app/download/a.apk', 'https://site.nl')).toBe('https://site.nl/api/app/download/a.apk');
    expect(absoluteUrl('https://api.nl', '/app/download/a.apk', 'https://site.nl')).toBe('https://api.nl/app/download/a.apk');
  });

  test('code is shown in two groups of four', () => {
    expect(formatPairingCode('ABCD2345')).toBe('ABCD-2345');
  });

  test('countdown', () => {
    const expiresAt = '2026-10-17T10:05:00.000Z';
    expect(secondsLeft(expiresAt, Date.parse('2026-10-17T10:00:55.400Z'))).toBe(245);
    expect(secondsLeft(expiresAt, Date.parse('2026-10-17T10:06:00Z'))).toBe(0);
    expect(formatCountdown(245)).toBe('4:05');
    expect(formatCountdown(0)).toBe('0:00');
  });
});

describe('fetchLatestRelease', () => {
  const axiosError = (status: number) => ({ isAxiosError: true, response: { status } });

  test('returns the value on success', async () => {
    expect(await fetchLatestRelease(async () => ({ versionCode: 1 }))).toEqual({ versionCode: 1 });
  });

  test('404 means no release yet', async () => {
    expect(await fetchLatestRelease(() => Promise.reject(axiosError(404)))).toBeNull();
  });

  test('other failures are rethrown', async () => {
    const err = axiosError(500);
    await expect(fetchLatestRelease(() => Promise.reject(err))).rejects.toBe(err);
    const network = { isAxiosError: true };
    await expect(fetchLatestRelease(() => Promise.reject(network))).rejects.toBe(network);
  });
});
