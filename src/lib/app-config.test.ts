import { describe, expect, test } from 'bun:test';
import { apiAssetUrl, DEFAULT_CONFIG, draftFrom, fromLocalInput, generalPatch, huntWindow, isDirty, timelineGeometry, toLocalInput, vehicleGroupIds, type AdminConfig, type GeneralDraft } from './app-config';

describe('app config helpers', () => {
  test('branding paths go to the API, other urls stay', () => {
    expect(apiAssetUrl('/branding/logo?v=1', 'https://x.dev/api')).toBe('https://x.dev/api/branding/logo?v=1');
    expect(apiAssetUrl('/logo.svg', 'https://x.dev/api')).toBe('/logo.svg');
    expect(apiAssetUrl('https://cdn/x.png', 'https://x.dev/api')).toBe('https://cdn/x.png');
  });

  test('datetime-local round trip in local time', () => {
    const iso = '2026-10-17T07:00:00.000Z';
    const local = toLocalInput(iso);
    expect(local).toMatch(/^2026-10-17T\d\d:00$/);
    expect(fromLocalInput(local)).toBe(iso);
    expect(toLocalInput(null)).toBe('');
    expect(fromLocalInput('')).toBeNull();
  });

  test('hunt window and vehicle groups', () => {
    const config = { ...DEFAULT_CONFIG, huntStart: '2026-10-17T07:00:00.000Z', vehicleGroups: { walking: 1, bike: null, car: 3, motorcycle: null } };
    expect(huntWindow(config).start?.toISOString()).toBe('2026-10-17T07:00:00.000Z');
    expect(huntWindow(config).end).toBeNull();
    expect(vehicleGroupIds(config)).toEqual({ walking: 1, car: 3 });
  });
});

describe('Algemeen draft', () => {
  const base: GeneralDraft = {
    huntStart: '2026-10-17T09:00',
    huntEnd: '2026-10-18T15:00',
    homeTeamApiId: 12,
    groupName: 'A',
    logoUrl: '',
    discordUrl: '',
    vehicleGroups: { walking: 1, bike: 2, car: 3, motorcycle: null },
    jotihuntWebUsername: 'u',
    jotihuntWebPassword: '',
  };

  test('patch holds only changes; empty text clears', () => {
    expect(generalPatch(base, base)).toEqual({});
    expect(isDirty(base, base)).toBe(false);
    const next = { ...base, groupName: ' ', vehicleGroups: { ...base.vehicleGroups, car: 4 } };
    expect(generalPatch(base, next)).toEqual({ groupName: null, vehicleGroups: { car: 4 } });
    expect(isDirty(base, { ...base, jotihuntWebPassword: 'x' })).toBe(true);
    expect(isDirty(base, { ...base, jotihuntWebUsername: 'v' })).toBe(true);
  });

  test('hunt times go back to ISO; a cleared time is null', () => {
    const patch = generalPatch(base, { ...base, huntStart: '2026-10-17T10:00', huntEnd: '' });
    expect(patch.huntStart).toBe(new Date('2026-10-17T10:00').toISOString());
    expect(patch.huntEnd).toBeNull();
  });

  test('draft from the admin config: the default logo shows empty, the password never', () => {
    const config = {
      general: {
        groupName: { value: 'Wolfsheuvel', source: 'env' },
        logoUrl: { value: '/logo.svg', source: 'default' },
        discordUrl: { value: null, source: 'default' },
        huntStart: { value: '2026-10-17T07:00:00.000Z', source: 'db' },
        huntEnd: { value: null, source: 'default' },
        homeTeamApiId: { value: 7, source: 'db' },
        vehicleGroups: { value: { walking: 1, bike: null, car: 3, motorcycle: null }, source: 'db' },
      },
      plain: { jotihuntWebUsername: { value: 'wolf', source: 'env' }, telegramApiId: { value: null, source: 'default' }, telegramBotUsername: { value: null, source: 'default' } },
    } as unknown as AdminConfig;
    const draft = draftFrom(config);
    expect(draft).toEqual({
      huntStart: toLocalInput('2026-10-17T07:00:00.000Z'),
      huntEnd: '',
      homeTeamApiId: 7,
      groupName: 'Wolfsheuvel',
      logoUrl: '',
      discordUrl: '',
      vehicleGroups: { walking: 1, bike: null, car: 3, motorcycle: null },
      jotihuntWebUsername: 'wolf',
      jotihuntWebPassword: '',
    });
  });
});

describe('hunt timeline', () => {
  const H = 3_600_000;
  test('fill between start and end, now tick inside the range', () => {
    const start = Date.parse('2026-10-17T07:00:00Z');
    const end = start + 30 * H;
    const geo = timelineGeometry(start, end, start - 10 * H);
    // range: now - 2h .. end + 2h = 44h
    expect(geo.now).toBe(0 + (2 / 44) * 100);
    expect(geo.left).toBeCloseTo((12 / 44) * 100);
    expect(geo.width).toBeCloseTo((30 / 44) * 100);
  });
  test('no now tick after the end; end before start has no fill', () => {
    const start = Date.parse('2026-10-17T07:00:00Z');
    expect(timelineGeometry(start, start + H, start + 10 * H).now).toBeNull();
    expect(timelineGeometry(start, start - H, start).width).toBe(0);
  });
});
