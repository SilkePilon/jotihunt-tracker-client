import { describe, expect, test } from 'bun:test';
import { BehaviorSubject as RealBehaviorSubject } from 'rxjs';
import { BehaviorSubject } from './rxjs-shim';

type Subject = { next(v: number): void; readonly value: number; subscribe(o: { next: (v: number) => void }): { unsubscribe(): void } };

/** Runs the same scenario on a subject and returns everything observers saw. */
function scenario(subject: Subject) {
  const log: string[] = [];
  log.push(`value ${subject.value}`);
  const a = subject.subscribe({ next: (v) => log.push(`a ${v} (value ${subject.value})`) });
  subject.next(2);
  const b = subject.subscribe({ next: (v) => log.push(`b ${v}`) });
  subject.next(3);
  a.unsubscribe();
  a.unsubscribe();
  subject.next(4);
  b.unsubscribe();
  subject.next(5);
  log.push(`value ${subject.value}`);
  return log;
}

describe('rxjs BehaviorSubject shim', () => {
  test('behaves like rxjs for what react-auth-kit uses', () => {
    const real = scenario(new RealBehaviorSubject(1));
    expect(scenario(new BehaviorSubject(1))).toEqual(real);
    expect(real).toEqual(['value 1', 'a 1 (value 1)', 'a 2 (value 2)', 'b 2', 'a 3 (value 3)', 'b 3', 'b 4', 'value 5']);
  });

  test('subscribing with a plain function and missing next', () => {
    const subject = new BehaviorSubject('x');
    const seen: string[] = [];
    subject.subscribe((v) => seen.push(v));
    subject.subscribe({ error: () => {}, complete: () => {} });
    subject.next('y');
    expect(seen).toEqual(['x', 'y']);
    expect(subject.getValue()).toBe('y');
  });

  test('unsubscribing during a notification does not skip the others', () => {
    const subject = new BehaviorSubject(0);
    const seen: string[] = [];
    const first = subject.subscribe({ next: (v) => { seen.push(`first ${v}`); if (v === 1) first.unsubscribe(); } });
    subject.subscribe({ next: (v) => seen.push(`second ${v}`) });
    subject.next(1);
    subject.next(2);
    expect(seen).toEqual(['first 0', 'second 0', 'first 1', 'second 1', 'second 2']);
  });

  test('a throwing observer does not stop the others; the error is rethrown asynchronously', async () => {
    const subject = new BehaviorSubject(0);
    const seen: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    const deferred: unknown[] = [];
    globalThis.setTimeout = ((fn: () => void) => {
      try { fn(); } catch (err) { deferred.push(err); }
      return 0;
    }) as unknown as typeof setTimeout;
    try {
      subject.subscribe({ next: (v) => { if (v === 1) throw new Error('boom'); } });
      subject.subscribe({ next: (v) => seen.push(v) });
      subject.next(1);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
    expect(seen).toEqual([0, 1]);
    expect(deferred).toHaveLength(1);
    expect((deferred[0] as Error).message).toBe('boom');
  });
});
