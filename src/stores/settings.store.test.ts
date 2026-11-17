import { describe, expect, test } from 'bun:test';

// A stored state from before the shortcuts switch existed; bun has no localStorage, so give the store one
const stored = new Map<string, string>([['settings-storage', JSON.stringify({ state: { mapStyle: '', soundMuted: true }, version: 2 })]]);
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
const { default: useSettingsStore } = await import('./settings.store');

describe('settings store: shortcutsEnabled', () => {
  test('on by default, also for a stored state that predates it', () => {
    expect(useSettingsStore.getState().shortcutsEnabled).toBe(true);
    expect(useSettingsStore.getState().soundMuted).toBe(true);
  });
  test('turning it off is persisted', () => {
    useSettingsStore.getState().setShortcutsEnabled(false);
    expect(useSettingsStore.getState().shortcutsEnabled).toBe(false);
    expect(JSON.parse(stored.get('settings-storage') ?? '{}').state.shortcutsEnabled).toBe(false);
    useSettingsStore.getState().setShortcutsEnabled(true);
    expect(JSON.parse(stored.get('settings-storage') ?? '{}').state.shortcutsEnabled).toBe(true);
  });
});
