import { describe, expect, test } from 'bun:test';
import { isForbiddenArea } from './huntable-areas';

describe('isForbiddenArea', () => {
  test('not configured (null) or still loading (undefined): nothing is forbidden', () => {
    expect(isForbiddenArea('bravo', 'Alpha', null)).toBe(false);
    expect(isForbiddenArea('bravo', 'Alpha', undefined)).toBe(false);
  });

  test('our own area is never forbidden, even when the list leaves it out', () => {
    expect(isForbiddenArea('alpha', 'alpha', [])).toBe(false);
    expect(isForbiddenArea('alpha', 'alpha', ['bravo'])).toBe(false);
  });

  test('an allowed area is not forbidden', () => {
    expect(isForbiddenArea('bravo', 'alpha', ['bravo', 'delta'])).toBe(false);
  });

  test('an area outside the list is forbidden; an empty list forbids every other area', () => {
    expect(isForbiddenArea('charlie', 'alpha', ['bravo'])).toBe(true);
    expect(isForbiddenArea('oscar', 'alpha', [])).toBe(true);
  });

  test('case-insensitive for the area and our own area ("Alpha" from /areas and /teams)', () => {
    expect(isForbiddenArea('Bravo', 'alpha', ['bravo'])).toBe(false);
    expect(isForbiddenArea('ALPHA', ' Alpha ', [])).toBe(false);
    expect(isForbiddenArea('Charlie', 'Alpha', ['bravo'])).toBe(true);
  });

  test('own area unknown: only the list counts', () => {
    expect(isForbiddenArea('alpha', undefined, ['bravo'])).toBe(true);
    expect(isForbiddenArea('bravo', undefined, ['bravo'])).toBe(false);
  });
});
