import { describe, expect, test } from 'bun:test';
import { AxiosError, AxiosHeaders } from 'axios';
import { allFallback, badgeImageId, rebuildFailure, changedLegIds, legLooks, flipLabel, flipTarget, formatDuration, formatKm, legRows, legSubtitle, legTitle, parseBadgeImageId, visibleTrails } from './trails';
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

describe('allFallback', () => {
  const collection = (...fallbacks: boolean[]): TrailCollection => ({
    type: 'FeatureCollection',
    features: fallbacks.map((fallback, i) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[5, 52], [5.1, 52]] }, properties: { ...base, id: `l${i}`, fallback } })),
  });
  test('only when every leg is a fallback', () => {
    expect(allFallback(collection(true, true))).toBe(true);
    expect(allFallback(collection(true, false))).toBe(false);
    expect(allFallback(collection())).toBe(false);
  });
});

describe('changedLegIds', () => {
  const look = (id: string, mode: TrailProperties['mode'], fallback = false) => ({ properties: { id, mode, fallback } });
  test('new legs and mode or fallback changes, not unchanged ones', () => {
    const previous = legLooks([look('a', 'walk'), look('b', 'walk'), look('c', 'car', true), look('gone', 'walk')]);
    const next = legLooks([look('a', 'walk'), look('b', 'car'), look('c', 'car'), look('d', 'walk')]);
    expect(changedLegIds(previous, next)).toEqual(['b', 'c', 'd']);
    expect(changedLegIds(next, next)).toEqual([]);
  });
});

describe('rebuildFailure', () => {
  const axiosError = (status: number) => new AxiosError('x', 'ERR', undefined, undefined, { status, statusText: '', data: {}, headers: {}, config: { headers: new AxiosHeaders() } });
  test('409 is busy, anything else failed', () => {
    expect(rebuildFailure(axiosError(409))).toBe('busy');
    expect(rebuildFailure(axiosError(503))).toBe('failed');
    expect(rebuildFailure(new Error('network'))).toBe('failed');
  });
});
