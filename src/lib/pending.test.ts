import { describe, expect, test } from 'bun:test';
import { createPendingGuard } from './pending';

describe('createPendingGuard', () => {
  test('refuses a second action while one runs, reports the kind and clears it', async () => {
    const changes: (string | null)[] = [];
    const run = createPendingGuard<'send' | 'cancel'>((kind) => changes.push(kind));
    let release!: (value: string) => void;
    const first = run('send', () => new Promise<string>((resolve) => (release = resolve)));
    const second = await run('cancel', () => Promise.resolve('cancelled'));
    expect(second).toBeUndefined();
    release('sent');
    expect(await first).toBe('sent');
    expect(changes).toEqual(['send', null]);
    expect(await run('cancel', () => Promise.resolve('cancelled'))).toBe('cancelled');
  });

  test('clears after a throw', async () => {
    const changes: (string | null)[] = [];
    const run = createPendingGuard<'send'>((kind) => changes.push(kind));
    await expect(run('send', () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    expect(changes).toEqual(['send', null]);
    expect(await run('send', () => Promise.resolve(1))).toBe(1);
  });
});
