import { describe, expect, mock, test } from 'bun:test';
import { layerGroups, type LayerFlags } from './layer-toggles';

function flags(overrides: Partial<LayerFlags> = {}): LayerFlags {
  const noop = mock(() => {});
  return {
    showTeams: true, showDevices: true, showMarkersPart1: false, showMarkersPart2: true, showHomeCircle: true,
    showGroupCircles: false, showPredictions: true, showLife360: true, showBuildings3d: true,
    showMcDonalds: false, showKfc: true, showBurgerKing: false,
    toggleTeams: noop, toggleDevices: noop, toggleMarkersPart1: noop, toggleMarkersPart2: noop, toggleHomeCircle: noop,
    toggleGroupCircles: noop, togglePredictions: noop, toggleLife360: noop, toggleBuildings3d: noop,
    toggleMcDonalds: noop, toggleKfc: noop, toggleBurgerKing: noop,
    ...overrides,
  };
}

const labels = (result: ReturnType<typeof layerGroups>) => result.groups.map((group) => [group.title, group.rows.map((row) => row.label)]);

describe('layerGroups', () => {
  test('groups, order and labels', () => {
    expect(labels(layerGroups(flags(), { predictions: true, life360: true }))).toEqual([
      ['Spel', ['Groepen', 'Groepscirkels', 'Tegenhunt-cirkel', 'Markers', 'Voorspelling']],
      ['Team & kaart', ["Auto's", 'Life360', '3D-gebouwen']],
    ]);
  });
  test('Voorspelling only with predictions, Life360 only when linked', () => {
    expect(labels(layerGroups(flags(), { predictions: false, life360: false }))).toEqual([
      ['Spel', ['Groepen', 'Groepscirkels', 'Tegenhunt-cirkel', 'Markers']],
      ['Team & kaart', ["Auto's", '3D-gebouwen']],
    ]);
  });
  test('markers row carries both parts with their own state and toggle', () => {
    const toggleMarkersPart1 = mock(() => {});
    const row = layerGroups(flags({ toggleMarkersPart1 }), { predictions: true, life360: true }).groups[0].rows[3];
    expect(row.kind).toBe('markers');
    if (row.kind !== 'markers') return;
    expect(row.parts.map((part) => [part.label, part.ariaLabel, part.checked])).toEqual([
      ['1', 'Speelhelft 1', false],
      ['2', 'Speelhelft 2', true],
    ]);
    row.parts[0].toggle();
    expect(toggleMarkersPart1).toHaveBeenCalledTimes(1);
  });
  test('switch rows reflect the store', () => {
    const rows = layerGroups(flags(), { predictions: true, life360: true }).groups[0].rows;
    expect(rows.filter((row) => row.kind === 'switch').map((row) => (row.kind === 'switch' ? row.checked : null))).toEqual([true, false, true, true]);
  });
  test('food toggles in brand order', () => {
    const { food } = layerGroups(flags(), { predictions: true, life360: true });
    expect(food.title).toBe('Eten');
    expect(food.toggles.map((toggle) => [toggle.brand, toggle.label, toggle.checked])).toEqual([
      ['mcdonalds', "McDonald's", false],
      ['kfc', 'KFC', true],
      ['burgerking', 'Burger King', false],
    ]);
  });
});
