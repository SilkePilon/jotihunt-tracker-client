import { expect, test } from 'bun:test';
import { syncColorScheme, syncThemeColor, themeColor } from './theme-color';

test('themeColor matches the page background per theme', () => {
  expect(themeColor(false)).toBe('#ffffff');
  expect(themeColor(true)).toBe('#1a1a1e');
});

test('syncThemeColor sets every theme-color meta', () => {
  const metas = [{ content: '#ffffff' }, { content: '#000000' }];
  const doc = { querySelectorAll: () => metas } as unknown as Document;
  syncThemeColor(true, doc);
  expect(metas.map((meta) => meta.content)).toEqual(['#1a1a1e', '#1a1a1e']);
  syncThemeColor(false, doc);
  expect(metas.map((meta) => meta.content)).toEqual(['#ffffff', '#ffffff']);
});

test('syncColorScheme pins native controls to the app theme', () => {
  const doc = { documentElement: { style: { colorScheme: '' } } } as unknown as Document;
  syncColorScheme(true, doc);
  expect(doc.documentElement.style.colorScheme).toBe('dark');
  syncColorScheme(false, doc);
  expect(doc.documentElement.style.colorScheme).toBe('light');
});
