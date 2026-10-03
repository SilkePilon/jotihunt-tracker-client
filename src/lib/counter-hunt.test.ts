import { expect, test } from 'bun:test';
import { counterHuntAlertTitle } from './counter-hunt';

test('counterHuntAlertTitle matches the server text', () => {
  expect(counterHuntAlertTitle(45)).toBe('Tegenhunt! Richting NO ↗');
  expect(counterHuntAlertTitle(270)).toBe('Tegenhunt! Richting W ←');
  expect(counterHuntAlertTitle(10)).toBeNull();
});
