import { describe, expect, test } from 'bun:test';
import { popupAnnouncement } from './popup-announcement';

describe('popupAnnouncement', () => {
  test('names the opened popup', () => {
    expect(popupAnnouncement('Alpha · Hint')).toBe('Alpha · Hint geopend');
  });

  test('collapses whitespace from nested title markup', () => {
    expect(popupAnnouncement('  Scouting\n   Haarlem ')).toBe('Scouting Haarlem geopend');
  });

  test('says nothing without a title', () => {
    expect(popupAnnouncement('')).toBe('');
    expect(popupAnnouncement('   ')).toBe('');
    expect(popupAnnouncement(null)).toBe('');
    expect(popupAnnouncement(undefined)).toBe('');
  });
});
