import { describe, expect, test } from 'bun:test';
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import libertyJson from './liberty.json';
import {
  ANDROID_SEED,
  MAP_SEED,
  argbToCss,
  hueOf,
  lstar,
  mapPalette,
  materialStyle,
  roleOf,
  waterColors,
} from './material-style';

const liberty = libertyJson as unknown as StyleSpecification;
const light = mapPalette(ANDROID_SEED, false);
const dark = mapPalette(ANDROID_SEED, true);

function layer(style: StyleSpecification, id: string): LayerSpecification {
  const found = style.layers.find((l) => l.id === id);
  if (!found) throw new Error(`no layer ${id}`);
  return found;
}
const paint = (l: LayerSpecification, key: string) => (l as { paint?: Record<string, unknown> }).paint?.[key];
const hidden = (l: LayerSpecification) => (l as { layout?: Record<string, unknown> }).layout?.visibility === 'none';

describe('mapPalette', () => {
  test('the Android green seed reproduces the app fallback scheme (MapPaletteTest)', () => {
    expect(light.dark).toBe(false);
    expect(light.surface).toBe('#f7fbf1');
    expect(light.primaryContainer).toBe('#bcf0b4');
    expect(light.surfaceContainerLowest).toBe('#ffffff');
    expect(light.surfaceContainerLow).toBe('#f1f5eb');
    expect(light.surfaceContainer).toBe('#ecefe6');
    expect(light.surfaceContainerHighest).toBe('#e0e4db');
    expect(light.outline).toBe('#72796f');
    expect(light.outlineVariant).toBe('#c2c9bd');
    expect(light.onSurfaceVariant).toBe('#424940');
    expect(light.warnContainer).toBe('#ffddb8');
    expect(dark.dark).toBe(true);
    expect(dark.surface).toBe('#10140f');
    expect(dark.primaryContainer).toBe('#245024');
  });

  test('the website seed is the site primary orange and tints the surfaces warm', () => {
    expect(MAP_SEED).toBe(0xea580c);
    const p = mapPalette(MAP_SEED, false);
    // Orange-ish hue (HSL 15..45) for the primary container, which fills parks and woods
    expect(hueOf(p.primaryContainer)).toBeGreaterThan(10);
    expect(hueOf(p.primaryContainer)).toBeLessThan(45);
    expect(mapPalette(MAP_SEED, true).dark).toBe(true);
  });

  test('css colours', () => {
    expect(argbToCss(0xfff7fbf1)).toBe('#f7fbf1');
    expect(argbToCss(0x80000000)).toBe('rgba(0, 0, 0, 0.502)');
    expect(argbToCss(0x00ff0010)).toBe('rgba(255, 0, 16, 0)');
  });
});

describe('waterColors (WaterColorsTest)', () => {
  const primaries: Record<string, number> = {
    pink: 0xff8e4a6a,
    pinkDark: 0xffffb0cc,
    green: 0xff3b6939,
    greenDark: 0xffa1d39a,
    blue: 0xff415f91,
    red: 0xffb3261e,
    grey: 0xff777777,
    orange: 0xff8f4c2c,
  };

  test('water stays blue for any primary', () => {
    for (const [name, primary] of Object.entries(primaries)) {
      for (const isDark of [false, true]) {
        const w = waterColors(primary, isDark);
        for (const c of [w.water, w.onWater]) {
          const h = hueOf(argbToCss(c));
          expect(h, `${name} dark=${isDark}`).toBeGreaterThanOrEqual(185);
          expect(h, `${name} dark=${isDark}`).toBeLessThanOrEqual(235);
        }
      }
    }
  });

  test('tones match the container roles', () => {
    for (const primary of Object.values(primaries)) {
      const l = waterColors(primary, false);
      const d = waterColors(primary, true);
      expect(Math.abs(lstar(l.water) - 85)).toBeLessThan(1.5);
      expect(Math.abs(lstar(l.onWater) - 30)).toBeLessThan(1.5);
      expect(Math.abs(lstar(d.water) - 30)).toBeLessThan(1.5);
      expect(Math.abs(lstar(d.onWater) - 85)).toBeLessThan(1.5);
    }
  });

  test('hue pulls towards the primary', () => {
    const pink = hueOf(argbToCss(waterColors(0xff8e4a6a, false).water));
    const green = hueOf(argbToCss(waterColors(0xff3b6939, false).water));
    expect(pink).toBeGreaterThan(green);
  });

  test('the palette uses them', () => {
    const w = waterColors(0xff3b6939, false);
    expect(light.water).toBe(argbToCss(w.water));
    expect(light.onWater).toBe(argbToCss(w.onWater));
  });
});

describe('roleOf', () => {
  test('every bundled Liberty layer has a role', () => {
    const unknown = liberty.layers.filter((l) => roleOf(l.type, l.id) === 'keep').map((l) => l.id);
    expect(unknown).toEqual([]);
  });

  test('follows the table', () => {
    expect(roleOf('fill', 'landuse_residential')).toBe('landuse');
    expect(roleOf('fill', 'landcover_sand')).toBe('ground');
    expect(roleOf('fill', 'road_area_pattern')).toBe('hide');
    expect(roleOf('line', 'bridge_path_pedestrian_casing')).toBe('casing');
    expect(roleOf('line', 'tunnel_major_rail_hatching')).toBe('rail');
    expect(roleOf('line', 'tunnel_path_pedestrian')).toBe('road');
    expect(roleOf('line', 'waterway_river')).toBe('waterLine');
    expect(roleOf('line', 'aeroway_taxiway')).toBe('runway');
    expect(roleOf('line', 'park_outline')).toBe('parkOutline');
    expect(roleOf('line', 'boundary_disputed')).toBe('boundary');
    expect(roleOf('symbol', 'waterway_line_label')).toBe('waterLabel');
    expect(roleOf('symbol', 'highway-shield-non-us')).toBe('label');
    expect(roleOf('circle', 'something')).toBe('keep');
  });
});

describe('materialStyle (MapStylesTest)', () => {
  test('recolours', () => {
    const s = materialStyle(liberty, light);
    expect(paint(layer(s, 'background'), 'background-color')).toBe('#f7fbf1');
    expect(paint(layer(s, 'water'), 'fill-color')).toBe(light.water);
    expect(paint(layer(s, 'landcover_wood'), 'fill-color')).toBe(light.primaryContainer);
    expect(paint(layer(s, 'park'), 'fill-opacity')).toBe(0.55);
    expect(paint(layer(s, 'park'), 'fill-outline-color')).toBeUndefined();
    expect(paint(layer(s, 'building'), 'fill-color')).toBe(light.surfaceContainerHighest);
    expect(paint(layer(s, 'building'), 'fill-outline-color')).toBeUndefined();
    expect(paint(layer(s, 'landuse_residential'), 'fill-color')).toBe(light.surfaceContainer);
    expect(paint(layer(s, 'landcover_sand'), 'fill-color')).toBe(light.surfaceContainerLow);
    expect(paint(layer(s, 'waterway_river'), 'line-color')).toBe(light.water);
    expect(paint(layer(s, 'road_minor_casing'), 'line-color')).toBe(light.outlineVariant);
    expect(paint(layer(s, 'road_minor'), 'line-color')).toBe(light.surfaceContainerLowest);
    expect(paint(layer(s, 'road_motorway'), 'line-color')).toBe(light.warnContainer);
    expect(paint(layer(s, 'road_major_rail'), 'line-color')).toBe(light.outline);
    expect(paint(layer(s, 'boundary_2'), 'line-color')).toBe(light.outline);
    expect(paint(layer(s, 'aeroway_runway'), 'line-color')).toBe(light.surfaceContainerHighest);
    expect(paint(layer(s, 'park_outline'), 'line-color')).toBe(light.primaryContainer);
    expect(paint(layer(s, 'water_name_point_label'), 'text-color')).toBe(light.onWater);
    expect(paint(layer(s, 'label_city'), 'text-color')).toBe(light.onSurfaceVariant);
    expect(paint(layer(s, 'highway-name-minor'), 'text-halo-color')).toBe(light.surface);
  });

  test('hides POIs, the shaded-relief raster and 3D buildings', () => {
    const s = materialStyle(liberty, light);
    for (const id of ['poi_r20', 'poi_transit', 'airport', 'building-3d', 'natural_earth', 'road_area_pattern']) {
      expect(hidden(layer(s, id)), id).toBe(true);
    }
    expect(hidden(layer(s, 'label_city'))).toBe(false);
  });

  test('dark variants', () => {
    const s = materialStyle(liberty, dark);
    expect(paint(layer(s, 'park'), 'fill-opacity')).toBe(0.35);
    expect(paint(layer(s, 'road_minor'), 'line-color')).toBe(dark.surfaceContainerHigh);
  });

  test('keeps sources, glyphs, sprite and layer count; no visible fill pattern; input untouched', () => {
    const before = JSON.stringify(liberty);
    const s = materialStyle(liberty, light);
    expect(s.sources).toEqual(liberty.sources);
    expect(s.glyphs).toBe(liberty.glyphs);
    expect(s.sprite).toEqual(liberty.sprite);
    expect(s.layers.length).toBe(liberty.layers.length);
    expect(s.layers.some((l) => !hidden(l) && paint(l, 'fill-pattern') !== undefined)).toBe(false);
    expect(JSON.stringify(liberty)).toBe(before);
  });

  test('glyphs and sprite load from OpenFreeMap over https', () => {
    expect(liberty.glyphs).toStartWith('https://tiles.openfreemap.org/');
    expect(String(liberty.sprite)).toStartWith('https://tiles.openfreemap.org/');
  });
});

describe('materialMapStyle', () => {
  test('one style object per theme, built from the site seed', async () => {
    const { materialMapStyle } = await import('./index');
    expect(materialMapStyle(false)).toBe(materialMapStyle(false));
    expect(materialMapStyle(true)).not.toBe(materialMapStyle(false));
    const bg = materialMapStyle(true).layers.find((l) => l.id === 'background') as { paint: Record<string, unknown> };
    expect(bg.paint['background-color']).toBe(mapPalette(MAP_SEED, true).surface);
  });
});
