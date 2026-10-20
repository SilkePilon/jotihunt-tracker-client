import { expect, spyOn, test } from 'bun:test';
import { AxiosError, AxiosHeaders } from 'axios';
import { isIos, needsIosInstall, resyncPush, unsubscribePush, urlBase64ToUint8Array } from './push';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36';

test('iOS needs the app on the home screen for push', () => {
  expect(isIos(IPHONE)).toBe(true);
  expect(isIos(ANDROID)).toBe(false);
  expect(needsIosInstall(IPHONE, false)).toBe(true);
  expect(needsIosInstall(IPHONE, true)).toBe(false);
  expect(needsIosInstall(ANDROID, false)).toBe(false);
});

test('urlBase64ToUint8Array decodes url-safe base64', () => {
  expect([...urlBase64ToUint8Array('AQID_-8')]).toEqual([1, 2, 3, 255, 239]);
});

test('unsubscribePush deletes the endpoint on the server, then unsubscribes the browser', async () => {
  const calls: string[] = [];
  const g = globalThis as unknown as Record<string, unknown>;
  const original = { window: g.window, navigator: g.navigator, Notification: g.Notification };
  const subscription = { endpoint: 'https://push.example/1', unsubscribe: async () => void calls.push('unsubscribe') };
  g.window = { PushManager: {}, Notification: {} };
  g.Notification = {};
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { serviceWorker: { getRegistration: async () => ({ pushManager: { getSubscription: async () => subscription } }) } } });
  try {
    const fetch = (async (url: string, method?: string, body?: unknown) => void calls.push(`${method} ${url} ${JSON.stringify(body)}`)) as never;
    await unsubscribePush(fetch);
    expect(calls).toEqual(['DELETE /push/subscribe {"endpoint":"https://push.example/1"}', 'unsubscribe']);
    // errors are swallowed, but the browser still unsubscribes
    calls.length = 0;
    await unsubscribePush((async () => { throw new Error('offline'); }) as never);
    expect(calls).toEqual(['unsubscribe']);
    // a hanging request is cut off by the timeout, and the browser still unsubscribes
    calls.length = 0;
    await unsubscribePush((() => new Promise(() => {})) as never, 20);
    expect(calls).toEqual(['unsubscribe']);
  } finally {
    g.window = original.window;
    g.Notification = original.Notification;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: original.navigator });
  }
});

test('a 423 (archive edition shown) on resync or unsubscribe stays quiet', async () => {
  const calls: string[] = [];
  const g = globalThis as unknown as Record<string, unknown>;
  const original = { window: g.window, navigator: g.navigator, Notification: g.Notification };
  const subscription = { endpoint: 'https://push.example/1', toJSON: () => ({}), unsubscribe: async () => void calls.push('unsubscribe') };
  g.window = { PushManager: {}, Notification: {} };
  g.Notification = { permission: 'granted' };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { serviceWorker: { getRegistration: async () => ({ pushManager: { getSubscription: async () => subscription } }) } } });
  const warn = spyOn(console, 'warn').mockImplementation(() => {});
  const archive = (async () => {
    throw new AxiosError('x', 'E', undefined, undefined, { status: 423, data: { message: 'Archief is alleen-lezen' }, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } });
  }) as never;
  try {
    await resyncPush(archive);
    await unsubscribePush(archive);
    expect(warn).not.toHaveBeenCalled();
    expect(calls).toEqual(['unsubscribe']);
    // other errors still warn
    await resyncPush((async () => { throw new Error('offline'); }) as never);
    expect(warn).toHaveBeenCalledTimes(1);
  } finally {
    warn.mockRestore();
    g.window = original.window;
    g.Notification = original.Notification;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: original.navigator });
  }
});
