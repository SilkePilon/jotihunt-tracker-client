import { expect, test } from 'bun:test';
import { NOTIFICATIONS_PROMPT_VERSION as V } from './notifications';
import { isPromptSnoozed, markDevicePrompted, notificationsPromptDue, readDevicePromptedVersion, snoozePrompt } from './notifications-prompt';
import { devicePush } from './push';

function memory(): Storage {
  const map = new Map<string, string>();
  return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => void map.set(key, value) } as Storage;
}

test('a new prompt version for the user is due, whatever the device', () => {
  expect(notificationsPromptDue({ serverVersion: V - 1, deviceVersion: V, snoozed: false, push: 'on' })).toBe(true);
  expect(notificationsPromptDue({ serverVersion: V, deviceVersion: V, snoozed: false, push: 'off' })).toBe(false);
});

test('a device that never saved the dialog is due only while push is still off there', () => {
  expect(notificationsPromptDue({ serverVersion: V, deviceVersion: 0, snoozed: false, push: 'off' })).toBe(true);
  for (const push of ['on', 'blocked', 'install', 'unsupported'] as const) {
    expect(notificationsPromptDue({ serverVersion: V, deviceVersion: 0, snoozed: false, push })).toBe(false);
  }
});

test('"Later" snoozes the prompt for the rest of the session', () => {
  expect(notificationsPromptDue({ serverVersion: 0, deviceVersion: 0, snoozed: true, push: 'off' })).toBe(false);
  const session = memory();
  expect(isPromptSnoozed(session)).toBe(false);
  snoozePrompt(session);
  expect(isPromptSnoozed(session)).toBe(true);
});

test('device version round-trips and survives missing or throwing storage', () => {
  const local = memory();
  expect(readDevicePromptedVersion(local)).toBe(0);
  markDevicePrompted(local);
  expect(readDevicePromptedVersion(local)).toBe(V);
  expect(readDevicePromptedVersion(undefined)).toBe(0);
  const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  expect(readDevicePromptedVersion(throwing)).toBe(0);
  expect(() => markDevicePrompted(throwing)).not.toThrow();
  expect(isPromptSnoozed(throwing)).toBe(false);
  expect(() => snoozePrompt(throwing)).not.toThrow();
});

test('devicePush maps permission and the iPhone install case', () => {
  expect(devicePush('granted', false)).toBe('on');
  expect(devicePush('default', false)).toBe('off');
  expect(devicePush('denied', false)).toBe('blocked');
  expect(devicePush('unsupported', false)).toBe('unsupported');
  expect(devicePush('default', true)).toBe('install');
});
