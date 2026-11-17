import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { PROMO_STORAGE_KEY } from '@/lib/android-promo';
import useAndroidPromoStore from './android-promo.store';

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

beforeEach(() => {
  data.clear();
  useAndroidPromoStore.setState({ open: true, step: 'intro' });
});

describe('android promo "Niet meer tonen" undo', () => {
  test('stores never and closes; undo puts the earlier state back and reopens at the intro', () => {
    data.set(PROMO_STORAGE_KEY, JSON.stringify({ hiddenUntil: 123 }));
    const undo = useAndroidPromoStore.getState().neverWithUndo();
    expect(JSON.parse(data.get(PROMO_STORAGE_KEY)!)).toEqual({ never: true });
    expect(useAndroidPromoStore.getState().open).toBe(false);
    undo();
    expect(JSON.parse(data.get(PROMO_STORAGE_KEY)!)).toEqual({ hiddenUntil: 123 });
    expect(useAndroidPromoStore.getState()).toMatchObject({ open: true, step: 'intro' });
  });
});
