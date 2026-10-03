import { describe, expect, test } from 'bun:test';
import { asList, hasExpectedShape } from './response-shape';

describe('hasExpectedShape', () => {
  test('list endpoints need an array', () => {
    expect(hasExpectedShape('/markers', [])).toBe(true);
    expect(hasExpectedShape('/hunt-reports', [{ _id: 'a' }])).toBe(true);
    expect(hasExpectedShape('/markers', { message: 'x' })).toBe(false);
    expect(hasExpectedShape('/teams', '<html>proxy</html>')).toBe(false);
    expect(hasExpectedShape('/areas', null)).toBe(false);
  });

  test('object endpoints need an object, with extra checks where components depend on fields', () => {
    expect(hasExpectedShape('/tracker/me', { configured: false })).toBe(true);
    expect(hasExpectedShape('/tracker/me', '<html>proxy</html>')).toBe(false);
    expect(hasExpectedShape('/tracker/me', [])).toBe(false);
    expect(hasExpectedShape('/hints/board', { articles: [], cells: [] })).toBe(true);
    expect(hasExpectedShape('/hints/board', { message: 'x' })).toBe(false);
    expect(hasExpectedShape('/demo', { enabled: false, enabledAt: null, startedAt: null })).toBe(true);
    expect(hasExpectedShape('/demo', { message: 'x' })).toBe(false);
    expect(hasExpectedShape('/notifications/preferences', { message: 'x' })).toBe(false);
  });

  test('the query string is ignored', () => {
    expect(hasExpectedShape('/markers?since=x', [])).toBe(true);
    expect(hasExpectedShape('/hints/rd-preview?answer=1', { rd: null })).toBe(true);
  });
});

describe('asList', () => {
  test('arrays pass through, anything else is empty', () => {
    const list = [1, 2];
    expect(asList(list)).toBe(list);
    expect(asList(undefined)).toEqual([]);
    expect(asList({ message: 'x' })).toEqual([]);
  });
});
