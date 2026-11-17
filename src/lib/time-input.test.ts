import { expect, test } from 'bun:test';
import { timeInputValue, withTimeOfDay } from './time-input';

const base = new Date(2026, 9, 17, 9, 30, 15);
const fallback = new Date(2026, 9, 18, 12, 0);

test('a complete HH:MM sets the time on the base date without mutating it', () => {
  const result = withTimeOfDay(base, '14:05', fallback);
  expect([result.getDate(), result.getHours(), result.getMinutes(), result.getSeconds()]).toEqual([17, 14, 5, 0]);
  expect(base.getHours()).toBe(9);
});

test('empty, partial or impossible values give an Invalid Date', () => {
  for (const value of ['', '1', '14:', '1:05', '24:00', '12:60', 'ab:cd', '14:05:00']) {
    expect(Number.isNaN(withTimeOfDay(base, value, fallback).getTime())).toBe(true);
  }
});

test('after an invalid value the next valid one builds from the fallback, not from NaN', () => {
  const cleared = withTimeOfDay(base, '', fallback);
  const result = withTimeOfDay(cleared, '08:15', fallback);
  expect([result.getDate(), result.getHours(), result.getMinutes()]).toEqual([18, 8, 15]);
});

test('timeInputValue shows HH:MM or an empty field', () => {
  expect(timeInputValue(base)).toBe('09:30');
  expect(timeInputValue(new Date(NaN))).toBe('');
  expect(timeInputValue('09:30')).toBe('');
});
