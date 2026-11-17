import { describe, expect, test } from 'bun:test';
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import libertyJson from './liberty.json';
import { darkenColour, darkLibertyStyle, darkLightness, parseColour, toOklab } from './dark-liberty';
import { DARK_SHIELD_PREFIX, SHIELD_TEXT_DARK } from './material-style';

const liberty = libertyJson as unknown as StyleSpecification;
const dark = darkLibertyStyle(liberty);

type Loose = LayerSpecification & { paint?: Record<string, unknown>; layout?: Record<string, unknown> };
const layer = (style: StyleSpecification, id: string) => {
  const found = style.layers.find((l) => l.id === id);
  if (!found) throw new Error(`no layer ${id}`);
  return found as Loose;
};
const lightness = (css: unknown) => toOklab(parseColour(css as string)!)[0];

describe('parseColour', () => {
  test('hex (short and long), rgb(a) and hsl(a)', () => {
    expect(parseColour('#fff')).toEqual([1, 1, 1, 1]);
    expect(parseColour('#000000')).toEqual([0, 0, 0, 1]);
    expect(parseColour('rgba(255,255,255,0.7)')).toEqual([1, 1, 1, 0.7]);
    expect(parseColour('hsl(0,0%,100%)')).toEqual([1, 1, 1, 1]);
    const [r, g, b, a] = parseColour('hsla(0,100%,50%,0.5)')!;
    expect([r, g, b, a]).toEqual([1, 0, 0, 0.5]);
  });

  test('anything else is not a colour', () => {
    expect(parseColour('interpolate')).toBeUndefined();
    expect(parseColour('zoom')).toBeUndefined();
    expect(parseColour('rgb(1,2)')).toBeUndefined();
  });
});

describe('darkLightness', () => {
  test('ground and roads keep the light order; roads sit above the ground; lines and text flip', () => {
    expect(darkLightness(0.97, 'ground')).toBeGreaterThan(darkLightness(0.85, 'ground'));
    expect(darkLightness(1, 'road')).toBeGreaterThan(darkLightness(0.97, 'ground'));
    expect(darkLightness(0.5, 'line')).toBeGreaterThan(darkLightness(0.8, 'line'));
    expect(darkLightness(0.8, 'line')).toBeGreaterThan(darkLightness(0.97, 'ground'));
    expect(darkLightness(0, 'text')).toBeGreaterThan(darkLightness(0.5, 'text'));
    expect(darkLightness(0, 'text')).toBeGreaterThan(0.85);
  });
});

describe('darkenColour', () => {
  test('keeps alpha and passes non-colours through', () => {
    expect(darkenColour('rgba(255,255,255,0.7)', 'ground')).toMatch(/^rgba\(\d+, \d+, \d+, 0\.7\)$/);
    expect(darkenColour('linear', 'ground')).toBe('linear');
  });
});

describe('darkLibertyStyle', () => {
  test('the cream background turns dark (near the dark card)', () => {
    const bg = lightness(layer(dark, 'background').paint?.['background-color']);
    expect(bg).toBeGreaterThan(0.18);
    expect(bg).toBeLessThan(0.3);
  });

  test('every colour in every paint (expressions included) is dark, or light for text', () => {
    for (const l of dark.layers as Loose[]) {
      for (const [key, value] of Object.entries(l.paint ?? {})) {
        if (!key.endsWith('-color')) continue;
        const colours = JSON.stringify(value).match(/"(#[0-9a-fA-F]{3,6}|(rgb|hsl)a?\([^)]*\))"/g) ?? [];
        for (const c of colours) {
          const L = lightness(JSON.parse(c));
          if (key === 'text-color') expect(L).toBeGreaterThan(0.55);
          else expect(L).toBeLessThan(l.type === 'line' ? 0.61 : 0.31);
        }
      }
    }
  });

  test('roads and rails stand out from the ground', () => {
    const ground = lightness(layer(dark, 'background').paint?.['background-color']);
    expect(lightness(layer(dark, 'road_minor').paint?.['line-color'])).toBeGreaterThan(ground + 0.05);
    expect(lightness(layer(dark, 'road_major_rail').paint?.['line-color'])).toBeGreaterThan(ground + 0.05);
  });

  test('labels read on their halos', () => {
    const label = layer(dark, 'label_city');
    expect(lightness(label.paint?.['text-color']) - lightness(label.paint?.['text-halo-color'])).toBeGreaterThan(0.45);
  });

  test('road_N shields use the drawn dark shields with light text; other layers keep their layout', () => {
    const shield = layer(dark, 'highway-shield-non-us');
    expect(shield.layout?.['icon-image']).toEqual(['concat', DARK_SHIELD_PREFIX, ['get', 'ref_length']]);
    expect(shield.paint?.['text-color']).toBe(SHIELD_TEXT_DARK);
    expect(layer(dark, 'road_shield_us').layout).toEqual(layer(liberty, 'road_shield_us').layout);
  });

  test('the relief raster and sprite patterns are toned down; the input is untouched', () => {
    expect(layer(dark, 'natural_earth').paint?.['raster-brightness-max']).toBe(0.35);
    expect(layer(dark, 'road_area_pattern').paint?.['fill-opacity']).toBe(0.25);
    expect(layer(liberty, 'background').paint?.['background-color']).toBe('#f8f4f0');
    expect(dark.sources).toBe(liberty.sources);
  });
});
