import { describe, expect, test } from 'bun:test';
import { assignmentWriteKey } from './assignments.hook';

describe('assignmentWriteKey', () => {
  test('one key per account and assignment', () => {
    expect(assignmentWriteKey('Bearer a', 1)).toBe(assignmentWriteKey('Bearer a', 1));
    expect(assignmentWriteKey('Bearer a', 1)).not.toBe(assignmentWriteKey('Bearer a', 2));
    expect(assignmentWriteKey('Bearer a', 1)).not.toBe(assignmentWriteKey('Bearer b', 1));
  });
});
