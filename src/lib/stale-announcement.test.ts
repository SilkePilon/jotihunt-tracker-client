import { describe, expect, test } from 'bun:test';
import { problemAnnouncement } from './stale-announcement';

describe('problemAnnouncement', () => {
  test('no problem: empty', () => {
    expect(problemAnnouncement(null)).toBe('');
  });

  test('connection as a whole', () => {
    expect(problemAnnouncement({ ageMs: null, feeds: [], offline: true })).toBe('Geen verbinding');
    expect(problemAnnouncement({ ageMs: 180_000, feeds: [], offline: true })).toBe('Geen verbinding, gegevens niet bijgewerkt');
  });

  test('server answering with errors while online', () => {
    expect(problemAnnouncement({ ageMs: null, feeds: [], offline: false })).toBe('Geen actuele gegevens');
    expect(problemAnnouncement({ ageMs: 180_000, feeds: [], offline: false })).toBe('Gegevens niet bijgewerkt');
  });

  test('named feeds, without the age', () => {
    expect(problemAnnouncement({ ageMs: null, feeds: ['vossen'], offline: true })).toBe('Vossen niet geladen');
    expect(problemAnnouncement({ ageMs: 60_000, feeds: ['vossen', 'hunts', 'hints'], offline: true })).toBe('Vossen, hunts en hints niet bijgewerkt');
  });

  test('the age changing does not change the text', () => {
    expect(problemAnnouncement({ ageMs: 60_000, feeds: ['vossen'], offline: true })).toBe(problemAnnouncement({ ageMs: 600_000, feeds: ['vossen'], offline: true }));
  });
});
