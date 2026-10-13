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

  test('assignments are a list; the read state needs read and readBy', () => {
    expect(hasExpectedShape('/assignments', [])).toBe(true);
    expect(hasExpectedShape('/assignments', { message: 'x' })).toBe(false);
    expect(hasExpectedShape('/assignments/members', [{ _id: 'u1', name: 'Sanne' }])).toBe(true);
    expect(hasExpectedShape('/articles/read', { read: [], readBy: {} })).toBe(true);
    expect(hasExpectedShape('/articles/read', { read: [] })).toBe(false);
  });

  test('tegenhunt and Telegram answers', () => {
    expect(hasExpectedShape('/counter-hunt', { active: false })).toBe(true);
    expect(hasExpectedShape('/counter-hunt', { message: 'x' })).toBe(false);
    expect(hasExpectedShape('/telegram/messages?limit=50', { linked: true, messages: [] })).toBe(true);
    expect(hasExpectedShape('/telegram/messages?limit=50', { linked: true })).toBe(false);
    expect(hasExpectedShape('/admin/telegram', { state: 'linked' })).toBe(true);
    expect(hasExpectedShape('/admin/telegram', { message: 'x' })).toBe(false);
  });

  test('the query string is ignored', () => {
    expect(hasExpectedShape('/markers?since=x', [])).toBe(true);
    expect(hasExpectedShape('/hints/rd-preview?answer=1', { rd: null })).toBe(true);
  });
});

describe('asList', () => {
  test('arrays pass through, loading stays undefined, anything else is empty', () => {
    const list = [1, 2];
    expect(asList(list)).toBe(list);
    expect(asList(undefined)).toBeUndefined();
    expect(asList({ message: 'x' } as unknown as number[])).toEqual([]);
    expect(asList(null as unknown as number[])).toEqual([]);
  });
});
