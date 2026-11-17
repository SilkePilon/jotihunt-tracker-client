import { describe, expect, test } from 'bun:test';
import { viewFocusWanted } from './view-focus.hook';

describe('viewFocusWanted', () => {
  test('a later view (enabled on mount) takes focus when it arrives', () => expect(viewFocusWanted(true, false)).toBe(true));
  test('the first view arrives with its dialog and leaves focus alone', () => expect(viewFocusWanted(false, false)).toBe(false));
  test('the first view brought back while leaving takes focus on its return', () => expect(viewFocusWanted(false, true)).toBe(true));
});
