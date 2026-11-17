import { describe, expect, test } from 'bun:test';
import { isChunkLoadError } from './chunk-error';

describe('isChunkLoadError', () => {
  test('browser messages for a failed dynamic import', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/BeheerWindow-abc.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true);
  });

  test('other errors are not', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError('Loading chunk')).toBe(false);
  });
});
