import { describe, expect, test } from 'bun:test';
import type { TrackerMe } from '@/types/Tracker';
import {
  formatAccuracy,
  formatBattery,
  formatDistance,
  formatLastUpdate,
  formatSpeed,
  isVehicle,
  notConfiguredText,
  qrCodePath,
  sectionTransition,
  trackerRefreshInterval,
  trackerSummary,
} from './tracker';

const configured = (connected: boolean): TrackerMe => ({
  configured: true,
  qrUrl: 'http://tracker.test:5055/?id=jh-0123456789',
  deepLink: 'org.traccar.client://?url=http%3A%2F%2Ftracker.test%3A5055%2F&id=jh-0123456789',
  uniqueId: 'jh-0123456789',
  vehicle: 'walking',
  connected,
  stats: {},
});
const notConfigured: TrackerMe = { configured: false, reason: 'client_url_missing', connected: false };
const unreachable: TrackerMe = { configured: false, reason: 'unreachable', connected: false };

describe('trackerRefreshInterval', () => {
  test('10 s until connected, 30 s when connected, 60 s when not configured', () => {
    expect(trackerRefreshInterval(undefined)).toBe(10_000);
    expect(trackerRefreshInterval(configured(false))).toBe(10_000);
    expect(trackerRefreshInterval(configured(true))).toBe(30_000);
    expect(trackerRefreshInterval(notConfigured)).toBe(60_000);
  });
});

describe('trackerSummary', () => {
  test('per state', () => {
    expect(trackerSummary(undefined)).toBeUndefined();
    expect(trackerSummary(notConfigured)).toBe('Niet ingesteld');
    expect(trackerSummary(unreachable)).toBe('Niet bereikbaar');
    expect(trackerSummary(configured(false))).toBe('Niet verbonden');
    expect(trackerSummary(configured(true))).toBe('Verbonden');
  });
});

describe('notConfiguredText', () => {
  test('admins get the fix, others only the message', () => {
    expect(notConfiguredText('client_url_missing', true)).toEqual({
      title: 'Live tracking is nog niet ingesteld.',
      hint: 'Vul TRACCAR_CLIENT_URL en de Traccar-token in .env in.',
    });
    expect(notConfiguredText('api_missing', false)).toEqual({ title: 'Live tracking is nog niet ingesteld.', hint: undefined });
    expect(notConfiguredText('client_url_invalid', true).hint).toBe('TRACCAR_CLIENT_URL in .env is geen geldige http(s)-URL.');
    expect(notConfiguredText('unreachable', false).title).toBe('De trackerserver is nu niet bereikbaar.');
  });

  test('group_invalid: admins get the .env hint in the title, others a generic message', () => {
    expect(notConfiguredText('group_invalid', true)).toEqual({
      title: 'Traccar-groep bestaat niet — controleer GROUP_*_ID in .env',
    });
    expect(notConfiguredText('group_invalid', false)).toEqual({
      title: 'Live tracking is tijdelijk niet beschikbaar',
    });
  });
});

describe('sectionTransition', () => {
  test('opens on the first "not connected" and after a disconnect', () => {
    expect(sectionTransition(undefined, false)).toBe('open');
    expect(sectionTransition(true, false)).toBe('open');
  });
  test('collapses once when the phone connects', () => {
    expect(sectionTransition(false, true)).toBe('close');
  });
  test('no change otherwise (already connected on load, unchanged, not configured)', () => {
    expect(sectionTransition(undefined, true)).toBeNull();
    expect(sectionTransition(false, false)).toBeNull();
    expect(sectionTransition(true, true)).toBeNull();
    expect(sectionTransition(false, undefined)).toBeNull();
  });
});

describe('formatting', () => {
  test('speed, battery, accuracy, distance', () => {
    expect(formatSpeed(4.6)).toBe('4,6 km/u');
    expect(formatSpeed(18.5)).toBe('19 km/u');
    expect(formatSpeed(undefined)).toBe('–');
    expect(formatBattery(76)).toBe('76%');
    expect(formatBattery(undefined)).toBe('–');
    expect(formatAccuracy(6)).toBe('± 6 m');
    expect(formatAccuracy(undefined)).toBe('–');
    expect(formatDistance(850)).toBe('850 m');
    expect(formatDistance(4321)).toBe('4,3 km');
    expect(formatDistance(undefined)).toBe('–');
  });

  test('last update relative to now', () => {
    const now = new Date('2026-10-17T12:00:00Z').getTime();
    expect(formatLastUpdate('2026-10-17T11:59:30Z', now)).toBe('zojuist');
    expect(formatLastUpdate('2026-10-17T11:57:00Z', now)).toBe('3 min geleden');
    expect(formatLastUpdate('2026-10-17T09:30:00Z', now)).toBe('2 uur geleden');
    expect(formatLastUpdate(undefined, now)).toBe('–');
  });
});

describe('isVehicle', () => {
  test('only the four vehicles', () => {
    expect(isVehicle('bike')).toBe(true);
    expect(isVehicle('')).toBe(false);
    expect(isVehicle('boat')).toBe(false);
  });
});

describe('qrCodePath', () => {
  test('square matrix with the top-left finder pattern', () => {
    const { size, path } = qrCodePath('http://tracker.test:5055/?id=jh-0123456789&accuracy=highest');
    expect(size).toBeGreaterThanOrEqual(21);
    expect((size - 17) % 4).toBe(0);
    expect(path.startsWith('M0 0h1v1h-1z')).toBe(true);
    expect(path).toContain(`M${size - 1} 0h1v1h-1z`);
  });

  test('is deterministic', () => {
    expect(qrCodePath('abc')).toEqual(qrCodePath('abc'));
  });
});
