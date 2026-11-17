import { describe, expect, test } from 'bun:test';
import { NOTIFICATION_ICON } from './notification-icons';

describe('NOTIFICATION_ICON', () => {
  test('one distinct icon per kind; only a hunt verdict (approved / rejected) shares one', () => {
    const { 'hunt-rejected': rejected, ...rest } = NOTIFICATION_ICON;
    expect(rejected).toBe(NOTIFICATION_ICON['hunt-approved']);
    expect(new Set(Object.values(rest)).size).toBe(Object.keys(rest).length);
  });
});
