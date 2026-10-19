import { describe, expect, test } from 'bun:test';
import { badgeImageId, flipLabel, flipTarget, formatDuration, formatKm, legRows, legSubtitle, legTitle, parseBadgeImageId, visibleTrails } from './trails';
import type { TrailCollection, TrailProperties } from '@/types/Trail';

const base: TrailProperties = {
  id: 'a:b', area: 'alpha', fromId: 'a', toId: 'b', mode: 'walk', reason: 'walk', manual: false, night: false, nightFallback: false,
  fallback: false, fromTime: '2026-10-17T12:02:00.000Z', toTime: '2026-10-17T12:40:00.000Z', distanceM: 18400, durationS: 1320, walkDurationS: 9600,
};

describe('format', () => {
  test('duration', () => {
    expect(formatDuration(2280)).toBe('38 min');
    expect(formatDuration(9600)).toBe('2u 40m');
    expect(formatDuration(3600)).toBe('1u');
  });
  test('km', () => {
    expect(formatKm(18400)).toBe('18,4 km');
    expect(formatKm(950)).toBe('950 m');
  });
});

describe('popup texts', () => {
  test('too fast car leg', () => {
    const p = { ...base, mode: 'car' as const, reason: 'too-fast' as const };
    expect(legTitle(p, 'Alpha')).toBe('Alpha · Auto');
    expect(legSubtitle(p)).toBe('Automatisch · te snel om te lopen');
    expect(legRows(p)).toEqual({
      time: { title: '38 min', meta: '14:02 → 14:40' },
      route: { title: '18,4 km over de weg', meta: 'Lopen zou 2u 40m kosten' },
    });
    expect(flipLabel(p)).toBe('Toch gelopen');
    expect(flipTarget(p)).toBe('walk');
  });
  test('red status', () => {
    expect(legSubtitle({ ...base, mode: 'car', reason: 'status-red', redFrom: '2026-10-17T12:05:00.000Z', redTo: '2026-10-17T12:35:00.000Z' })).toBe('Automatisch · status rood 14:05–14:35');
  });
  test('night walk and manual', () => {
    expect(legTitle({ ...base, night: true }, 'Alpha')).toBe('Alpha · Lopen');
    expect(legSubtitle({ ...base, night: true })).toBe("'s Nachts · bossen dicht");
    expect(legSubtitle({ ...base, manual: true, reason: 'manual' })).toBe('Handmatig');
    expect(legRows({ ...base, night: true }).route).toEqual({ title: '18,4 km · nachtroute', meta: '± 22 min lopen' });
    expect(flipLabel(base)).toBe('Toch met auto');
  });
  test('fallback', () => {
    expect(legSubtitle({ ...base, fallback: true })).toBe('Lopend · rechte lijn');
    expect(legRows({ ...base, fallback: true }).route).toEqual({ title: 'Rechte lijn', meta: 'Router niet bereikbaar' });
  });
});

describe('badges', () => {
  test('ids round-trip', () => {
    expect(badgeImageId('walk', '#ea580c')).toBeNull();
    expect(badgeImageId('car', '#ea580c')).toBe('trail-badge:car:#ea580c');
    expect(parseBadgeImageId('trail-badge:extra:#123456')).toEqual({ mode: 'extra', color: '#123456' });
    expect(parseBadgeImageId('other')).toBeNull();
  });
});

describe('visibleTrails', () => {
  test('keeps legs whose two markers are visible and adds colour + badge', () => {
    const trails: TrailCollection = { type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { ...base, mode: 'car' }, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } },
      { type: 'Feature', properties: { ...base, id: 'b:c', fromId: 'b', toId: 'c' }, geometry: { type: 'LineString', coordinates: [[1, 1], [2, 2]] } },
    ] };
    const out = visibleTrails(trails, new Set(['a', 'b']), () => '#ea580c');
    expect(out.features).toHaveLength(1);
    expect(out.features[0].properties).toMatchObject({ color: '#ea580c', badge: 'trail-badge:car:#ea580c' });
  });
});
