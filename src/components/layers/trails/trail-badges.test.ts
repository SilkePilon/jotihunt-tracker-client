import { describe, expect, test } from 'bun:test';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { addTrailBadge } from './trail-badges';

function fakeMap(images: string[]) {
  const added: string[] = [];
  const map = { hasImage: (id: string) => images.includes(id), addImage: (id: string) => added.push(id) } as unknown as MaplibreMap;
  return { map, added };
}

describe('addTrailBadge', () => {
  test('ignores images that are not trail badges', () => {
    const { map, added } = fakeMap([]);
    expect(addTrailBadge(map, 'fox:alpha')).toBe(false);
    expect(addTrailBadge(map, 'trail-badge:walk:#fff')).toBe(false);
    expect(added).toEqual([]);
  });
  test('leaves a badge the map already has alone', () => {
    const { map, added } = fakeMap(['trail-badge:car:#f87171']);
    expect(addTrailBadge(map, 'trail-badge:car:#f87171')).toBe(true);
    expect(added).toEqual([]);
  });
});
