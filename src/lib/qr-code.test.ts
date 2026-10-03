import { describe, expect, test } from 'bun:test';
import { qrCodePath } from './qr-code';

describe('qrCodePath', () => {
  test('square matrix with the top-left finder pattern', () => {
    const { size, path } = qrCodePath('http://tracker.test:5055/?id=jh-0123456789&accuracy=highest');
    expect(size).toBeGreaterThanOrEqual(21);
    expect((size - 17) % 4).toBe(0);
    expect(path.startsWith('M0 0h1v1h-1z')).toBe(true);
    expect(path).toContain(`M${size - 1} 0h1v1h-1z`);
  });

  test('is deterministic', () => {
    expect(qrCodePath('abc')).toEqual(qrCodePath('abc'));
  });
});
