import { describe, expect, test } from 'bun:test';
import { rulerDroppedMessage, rulerTotalMetres, rulerUndoMessage } from './ruler-keys';

describe('rulerTotalMetres', () => {
  test('no or one point: 0; otherwise the sum of the legs', () => {
    expect(rulerTotalMetres([])).toBe(0);
    expect(rulerTotalMetres([[5.9, 52]])).toBe(0);
    // 0.01° latitude is about 1.11 km; there and back doubles it
    const leg = rulerTotalMetres([[5.9, 52], [5.9, 52.01]]);
    expect(leg).toBeGreaterThan(1100);
    expect(leg).toBeLessThan(1120);
    expect(rulerTotalMetres([[5.9, 52], [5.9, 52.01], [5.9, 52]])).toBeCloseTo(2 * leg, 6);
  });
});

describe('ruler messages', () => {
  test('dropping: the first point explains the keys, later ones give the total', () => {
    expect(rulerDroppedMessage(1, 0)).toBe('Punt 1 gezet. Pijltjes verschuiven het, Enter zet het volgende.');
    expect(rulerDroppedMessage(2, 350.4)).toBe('Punt 2 gezet, totaal 350 m.');
    expect(rulerDroppedMessage(3, 1250)).toBe('Punt 3 gezet, totaal 1,3 km.');
  });

  test('undo says what is left', () => {
    expect(rulerUndoMessage(0, 0)).toBe('Laatste punt weggehaald, geen punten meer.');
    expect(rulerUndoMessage(1, 0)).toBe('Laatste punt weggehaald, nog 1 punt.');
    expect(rulerUndoMessage(2, 800)).toBe('Laatste punt weggehaald, totaal 800 m.');
  });
});
