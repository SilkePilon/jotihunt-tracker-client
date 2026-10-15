import { describe, expect, test } from 'bun:test';
import { popPage, pushPage, replacePage } from './mobile-nav';

describe('mobile nav stack', () => {
  test('push adds a page', () => expect(pushPage([], { id: 'foxes' })).toEqual([{ id: 'foxes' }]));
  test('pushing the page that is already on top is a no-op', () => {
    const stack = [{ id: 'foxes' as const }];
    expect(pushPage(stack, { id: 'foxes' })).toBe(stack);
  });
  test('same id with other params is a new page', () => {
    expect(pushPage([{ id: 'hunts' }], { id: 'hunts', params: { reportId: '1' } })).toHaveLength(2);
  });
  test('pop removes the top; popping an empty stack stays empty', () => {
    expect(popPage([{ id: 'foxes' }, { id: 'hunts' }])).toEqual([{ id: 'foxes' }]);
    expect(popPage([])).toEqual([]);
  });
  test('replace swaps the top page (or pushes on an empty stack)', () => {
    expect(replacePage([{ id: 'foxes' }], { id: 'hunts' })).toEqual([{ id: 'hunts' }]);
    expect(replacePage([], { id: 'hunts' })).toEqual([{ id: 'hunts' }]);
  });
});
