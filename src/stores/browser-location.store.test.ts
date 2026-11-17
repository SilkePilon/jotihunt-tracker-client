import { beforeEach, expect, test } from 'bun:test';
import useBrowserLocationStore from './browser-location.store';

beforeEach(() => useBrowserLocationStore.getState().stop());

test('start keeps an earlier fix unless given a new one', () => {
  const store = useBrowserLocationStore.getState();
  store.start({ lat: 52, lng: 5 });
  expect(useBrowserLocationStore.getState()).toMatchObject({ active: true, position: { lat: 52, lng: 5 } });
  store.start();
  expect(useBrowserLocationStore.getState().position).toEqual({ lat: 52, lng: 5 });
});

test('stop drops the dot and its fix', () => {
  useBrowserLocationStore.getState().start({ lat: 52, lng: 5 });
  useBrowserLocationStore.getState().stop();
  expect(useBrowserLocationStore.getState()).toMatchObject({ active: false, position: null });
});
