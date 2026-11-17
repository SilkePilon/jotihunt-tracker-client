import { describe, expect, test } from 'bun:test';
import { latestGate } from './latest-gate';

describe('latestGate', () => {
  test('only the newest ticket per key is latest', () => {
    const gate = latestGate<string>();
    const first = gate.next('a');
    expect(gate.isLatest('a', first)).toBe(true);
    const second = gate.next('a');
    expect(gate.isLatest('a', first)).toBe(false);
    expect(gate.isLatest('a', second)).toBe(true);
  });

  test('keys are independent', () => {
    const gate = latestGate<number>();
    const a = gate.next(1);
    const b = gate.next(2);
    expect(gate.isLatest(1, a)).toBe(true);
    expect(gate.isLatest(2, b)).toBe(true);
    expect(gate.isLatest(2, a)).toBe(false);
  });

  test('an unknown key has no latest ticket', () => {
    expect(latestGate<string>().isLatest('x', 1)).toBe(false);
  });
});
