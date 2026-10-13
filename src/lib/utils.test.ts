import { describe, expect, test } from 'bun:test';
import { randomId } from './utils';

describe('randomId', () => {
  test('RFC 4122 v4 format and unique', () => {
    const a = randomId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(randomId()).not.toBe(a);
  });
});
