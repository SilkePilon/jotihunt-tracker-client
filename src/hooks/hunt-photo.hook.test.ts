import { describe, expect, test } from 'bun:test';
import { huntPhotoEnabled } from './hunt-photo.hook';

describe('huntPhotoEnabled', () => {
  test('loading: unknown', () => expect(huntPhotoEnabled(undefined, undefined)).toBeUndefined());
  test('loaded value, also when a later poll fails', () => {
    expect(huntPhotoEnabled({ enabled: false }, undefined)).toBe(false);
    expect(huntPhotoEnabled({ enabled: false }, new Error('offline'))).toBe(false);
    expect(huntPhotoEnabled({ enabled: true }, undefined)).toBe(true);
  });
  test('404 (old server) or another error without a value: photo on', () => expect(huntPhotoEnabled(undefined, { response: { status: 404 } })).toBe(true));
});
