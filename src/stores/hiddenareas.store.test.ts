import { afterAll, beforeEach, describe, expect, test } from 'bun:test';

const data = new Map<string, string>();
const storage = {
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => void data.set(key, value),
  removeItem: (key: string) => void data.delete(key),
};
const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
afterAll(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

const { default: useHiddenAreasStore } = await import('./hiddenareas.store');

beforeEach(() => {
  data.clear();
  useHiddenAreasStore.setState({ hiddenAreas: [], year: undefined });
});

describe('hidden areas per edition', () => {
  test('the first known year keeps the areas hidden so far', () => {
    useHiddenAreasStore.getState().toggleHidden('Alpha');
    useHiddenAreasStore.getState().syncEdition(2026);
    expect(useHiddenAreasStore.getState()).toMatchObject({ hiddenAreas: ['alpha'], year: 2026 });
  });

  test('the same year keeps them', () => {
    useHiddenAreasStore.setState({ hiddenAreas: ['alpha'], year: 2026 });
    useHiddenAreasStore.getState().syncEdition(2026);
    expect(useHiddenAreasStore.getState().hiddenAreas).toEqual(['alpha']);
  });

  test('another year clears them and is remembered', () => {
    useHiddenAreasStore.setState({ hiddenAreas: ['alpha', 'bravo'], year: 2025 });
    useHiddenAreasStore.getState().syncEdition(2026);
    expect(useHiddenAreasStore.getState()).toMatchObject({ hiddenAreas: [], year: 2026 });
    expect(JSON.parse(data.get('hidden-areas-storage')!).state).toMatchObject({ hiddenAreas: [], year: 2026 });
  });
});
