import { describe, expect, test } from 'bun:test';
import { problemAnnouncement } from './stale-announcement';

describe('problemAnnouncement', () => {
  test('no problem: empty', () => {
    expect(problemAnnouncement(null)).toBe('');
  });

  test('connection as a whole', () => {
    expect(problemAnnouncement({ ageMs: null, feeds: [] })).toBe('Geen verbinding');
    expect(problemAnnouncement({ ageMs: 180_000, feeds: [] })).toBe('Geen verbinding, gegevens niet bijgewerkt');
  });

  test('named feeds, without the age', () => {
    expect(problemAnnouncement({ ageMs: null, feeds: ['vossen'] })).toBe('Vossen niet geladen');
    expect(problemAnnouncement({ ageMs: 60_000, feeds: ['vossen', 'hunts', 'hints'] })).toBe('Vossen, hunts en hints niet bijgewerkt');
  });

  test('the age changing does not change the text', () => {
    expect(problemAnnouncement({ ageMs: 60_000, feeds: ['vossen'] })).toBe(problemAnnouncement({ ageMs: 600_000, feeds: ['vossen'] }));
  });
});
