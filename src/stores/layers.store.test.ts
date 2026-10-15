import { describe, expect, test } from 'bun:test';
import { migrateLayers } from './layers.store';

describe('migrateLayers', () => {
  test('version 0 turns the 3D buildings on and keeps the other layers', () => {
    expect(migrateLayers({ showBuildings3d: false, showTeams: false }, 0)).toEqual({
      showBuildings3d: true,
      showTeams: false,
    });
  });
  test('version 0 without stored state still gets the 3D buildings', () => {
    expect(migrateLayers(undefined, 0)).toEqual({ showBuildings3d: true });
  });
  test('version 1 is left alone (the user turned them off themselves)', () => {
    expect(migrateLayers({ showBuildings3d: false }, 1)).toEqual({ showBuildings3d: false });
  });
});
