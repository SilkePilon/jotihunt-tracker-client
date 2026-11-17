import { describe, expect, test } from 'bun:test';
import { combinedLoadState, loadState } from './load-state';

describe('loadState', () => {
  test('data wins over a later error', () => {
    expect(loadState([], new Error('x'))).toBe('ready');
    expect(loadState({ cells: [] }, undefined)).toBe('ready');
  });

  test('no data: error or loading', () => {
    expect(loadState(undefined, new Error('x'))).toBe('error');
    expect(loadState(undefined, undefined)).toBe('loading');
  });
});

describe('combinedLoadState', () => {
  test('ready only when all are ready; error beats loading', () => {
    expect(combinedLoadState('ready', 'ready')).toBe('ready');
    expect(combinedLoadState('ready', 'loading')).toBe('loading');
    expect(combinedLoadState('loading', 'error')).toBe('error');
  });
});
