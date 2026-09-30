import { describe, expect, test } from 'bun:test';
import { stepDuration } from './duration';

describe('stepDuration', () => {
  test('uses 4s + 40ms per character', () => {
    expect(stepDuration({ title: 'a'.repeat(10), body: 'b'.repeat(40) })).toBe(4000 + 40 * 50);
  });

  test('is at least 4s', () => {
    expect(stepDuration({ title: '', body: '' })).toBe(4000);
  });

  test('is at most 10s', () => {
    expect(stepDuration({ title: 'x', body: 'y'.repeat(1000) })).toBe(10000);
  });

  test('durationMs overrides the formula', () => {
    expect(stepDuration({ title: 'x', body: 'y', durationMs: 1234 })).toBe(1234);
  });
});
