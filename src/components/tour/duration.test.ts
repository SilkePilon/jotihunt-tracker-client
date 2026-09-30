import { describe, expect, test } from 'bun:test';
import { stepDuration } from './duration';

describe('stepDuration', () => {
  test('uses 6s + 60ms per character', () => {
    expect(stepDuration({ title: 'a'.repeat(10), body: 'b'.repeat(40) })).toBe(6000 + 60 * 50);
  });

  test('is at least 6s', () => {
    expect(stepDuration({ title: '', body: '' })).toBe(6000);
  });

  test('is at most 15s', () => {
    expect(stepDuration({ title: 'x', body: 'y'.repeat(1000) })).toBe(15000);
  });

  test('durationMs overrides the formula', () => {
    expect(stepDuration({ title: 'x', body: 'y', durationMs: 1234 })).toBe(1234);
  });
});
