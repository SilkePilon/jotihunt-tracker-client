import { describe, expect, test } from 'bun:test';
import { cn } from './cn';

describe('cn type scale', () => {
  test('named sizes are font sizes, not colours', () => {
    expect(cn('text-label text-muted-foreground')).toBe('text-label text-muted-foreground');
    expect(cn('text-caption', 'text-primary-text')).toBe('text-caption text-primary-text');
    expect(cn('text-title font-bold', 'text-muted-foreground')).toBe('text-title font-bold text-muted-foreground');
  });

  test('named sizes still merge with other font sizes', () => {
    expect(cn('text-body', 'text-sm')).toBe('text-sm');
    expect(cn('text-title', 'text-base')).toBe('text-base');
    expect(cn('text-xs desk:text-label', 'desk:text-body')).toBe('text-xs desk:text-body');
  });
});
