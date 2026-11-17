import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(import.meta.dir, '../../public/push-sw.js'), 'utf8');
const ORIGIN = 'https://tracker.example';

interface FakeClient {
  url: string;
  focused: boolean;
  messages: unknown[];
  focusCalls: number;
  postMessage: (message: unknown) => void;
  focus: () => Promise<FakeClient>;
}

function client(path: string, focused = false): FakeClient {
  const fake: FakeClient = {
    url: `${ORIGIN}${path}`,
    focused,
    messages: [],
    focusCalls: 0,
    postMessage: (message) => void fake.messages.push(message),
    focus: async () => {
      fake.focusCalls += 1;
      return fake;
    },
  };
  return fake;
}

/** Runs public/push-sw.js against a fake service-worker scope and taps a notification with `data`. */
async function tap(windows: FakeClient[], data: Record<string, unknown> = { url: '/', type: 'hint', articleId: 7 }) {
  const listeners: Record<string, (event: unknown) => void> = {};
  const opened: string[] = [];
  const scope = {
    navigator: { userAgent: 'test' },
    location: { origin: ORIGIN },
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners[type] = listener;
    },
    clients: { matchAll: async () => windows, openWindow: async (url: string) => void opened.push(url) },
  };
  new Function('self', SOURCE)(scope);
  let done: Promise<unknown> = Promise.resolve();
  listeners.notificationclick({ notification: { data, close: () => {} }, waitUntil: (promise: Promise<unknown>) => (done = promise) });
  await done;
  return { opened };
}

describe('push-sw notificationclick', () => {
  test('posts to a tracker window, not to the HQ wall or the login page listed before it', async () => {
    const hq = client('/hq');
    const login = client('/login');
    const tracker = client('/');
    const { opened } = await tap([hq, login, tracker]);
    expect(hq.messages).toEqual([]);
    expect(login.messages).toEqual([]);
    expect(tracker.messages).toEqual([{ type: 'notification-click', data: { url: '/', type: 'hint', articleId: 7 } }]);
    expect(tracker.focusCalls).toBe(1);
    expect(opened).toEqual([]);
  });

  test('prefers the focused tracker window', async () => {
    const background = client('/users');
    const front = client('/', true);
    await tap([background, front]);
    expect(front.messages).toHaveLength(1);
    expect(background.messages).toHaveLength(0);
  });

  test('without a tracker window, opens the notification URL', async () => {
    const hq = client('/hq', true);
    const { opened } = await tap([hq]);
    expect(hq.messages).toEqual([]);
    expect(hq.focusCalls).toBe(0);
    expect(opened).toEqual([`${ORIGIN}/`]);
  });
});
