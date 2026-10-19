import { describe, expect, test } from 'bun:test';

// A stored version 1 state from before the fastfood layers existed; bun has no localStorage, so give the store one
const stored = new Map<string, string>([['layers-storage', JSON.stringify({ state: { showTeams: false, showBuildings3d: false }, version: 1 })]]);
globalThis.localStorage = {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => void stored.set(key, value),
  removeItem: (key: string) => void stored.delete(key),
  clear: () => stored.clear(),
  key: (index: number) => [...stored.keys()][index] ?? null,
  get length() {
    return stored.size;
  },
} as Storage;

// Imported after the shim so the store hydrates from it
const { default: useLayersStore, migrateLayers } = await import('./layers.store');

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

describe('persisted layers', () => {
  test('a stored version 1 state without the fastfood keys gets them off, and keeps its own toggles', () => {
    const state = useLayersStore.getState();
    expect(state.showTeams).toBe(false);
    expect(state.showBuildings3d).toBe(false);
    expect(state.showMcDonalds).toBe(false);
    expect(state.showKfc).toBe(false);
    expect(state.showBurgerKing).toBe(false);
  });
});
