import { describe, expect, test } from 'bun:test';
import { HQ_UNLOCK_KEY, hqUnlockMode, probeAudio, readUnlockFlag, writeUnlockFlag } from './hq-unlock';

function memoryStorage() {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
}

describe('hqUnlockMode', () => {
  test('never clicked in this tab: the full overlay, whatever the browser allows', () => {
    expect(hqUnlockMode(false, 'unknown')).toBe('overlay');
    expect(hqUnlockMode(false, 'allowed')).toBe('overlay');
    expect(hqUnlockMode(false, 'blocked')).toBe('overlay');
  });

  test('after a reload: nothing while checking, nothing when sound may play, the corner tile when blocked', () => {
    expect(hqUnlockMode(true, 'unknown')).toBe('checking');
    expect(hqUnlockMode(true, 'allowed')).toBe('unlocked');
    expect(hqUnlockMode(true, 'blocked')).toBe('tile');
  });
});

describe('unlock flag', () => {
  test('round-trips through storage', () => {
    const storage = memoryStorage();
    expect(readUnlockFlag(storage)).toBe(false);
    writeUnlockFlag(storage);
    expect(readUnlockFlag(storage)).toBe(true);
    expect(storage.getItem(HQ_UNLOCK_KEY)).toBe('1');
  });

  test('no storage or a throwing one: not unlocked, no crash', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readUnlockFlag(undefined)).toBe(false);
    expect(readUnlockFlag(throwing)).toBe(false);
    expect(() => writeUnlockFlag(throwing)).not.toThrow();
  });
});

describe('probeAudio', () => {
  const contextIn = (state: AudioContextState) =>
    class {
      state = state;
      close = () => Promise.resolve();
    };

  test('the autoplay policy API decides when present', () => {
    expect(probeAudio({ getAutoplayPolicy: () => 'allowed' }, contextIn('suspended'))).toBe('allowed');
    expect(probeAudio({ getAutoplayPolicy: () => 'allowed-muted' }, contextIn('running'))).toBe('blocked');
    expect(probeAudio({ getAutoplayPolicy: () => 'disallowed' }, contextIn('running'))).toBe('blocked');
  });

  test('otherwise a running AudioContext means sound may play', () => {
    expect(probeAudio({}, contextIn('running'))).toBe('allowed');
    expect(probeAudio({}, contextIn('suspended'))).toBe('blocked');
  });

  test('a throwing policy API falls back to the AudioContext', () => {
    const nav = {
      getAutoplayPolicy: () => {
        throw new TypeError('needs an element');
      },
    };
    expect(probeAudio(nav, contextIn('running'))).toBe('allowed');
  });

  test('no way to tell: blocked, so the tile offers the click', () => {
    expect(probeAudio(undefined, undefined)).toBe('blocked');
    const Broken = class {
      constructor() {
        throw new Error('no audio device');
      }
    } as unknown as new () => { state: AudioContextState; close(): Promise<void> };
    expect(probeAudio({}, Broken)).toBe('blocked');
  });
});
