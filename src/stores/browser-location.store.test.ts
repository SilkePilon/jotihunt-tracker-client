import { beforeEach, expect, test } from 'bun:test';
import useBrowserLocationStore from './browser-location.store';

beforeEach(() => useBrowserLocationStore.getState().stop());

test('start keeps an earlier fix unless given a new one', () => {
  const store = useBrowserLocationStore.getState();
  store.start({ lat: 52, lng: 5 }, 12);
  expect(useBrowserLocationStore.getState()).toMatchObject({ active: true, position: { lat: 52, lng: 5 }, accuracy: 12, fresh: true });
  store.start();
  expect(useBrowserLocationStore.getState()).toMatchObject({ position: { lat: 52, lng: 5 }, accuracy: 12 });
});

test('stop drops the dot and its fix', () => {
  useBrowserLocationStore.getState().start({ lat: 52, lng: 5 }, 12);
  useBrowserLocationStore.getState().stop();
  expect(useBrowserLocationStore.getState()).toMatchObject({ active: false, position: null, accuracy: null, fresh: false });
});

test('a stale dot stays (and stays active) until the next fix makes it fresh again', () => {
  const store = useBrowserLocationStore.getState();
  store.start({ lat: 52, lng: 5 }, 12);
  store.markStale();
  expect(useBrowserLocationStore.getState()).toMatchObject({ active: true, position: { lat: 52, lng: 5 }, fresh: false });
  store.setPosition({ lat: 52.1, lng: 5.1 }, 40);
  expect(useBrowserLocationStore.getState()).toMatchObject({ position: { lat: 52.1, lng: 5.1 }, accuracy: 40, fresh: true });
});
