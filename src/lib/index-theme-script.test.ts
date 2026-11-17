import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { THEME_COLOR } from './theme-color';

// The inline script in index.html that applies the theme before React mounts (no white flash for dark users)
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const script = html.match(/<body>\s*<script>([\s\S]*?)<\/script>/)?.[1] ?? '';

function run(stored: string | null, osDark: boolean) {
  const classes = new Set<string>();
  const metas = [{ value: '' }, { value: '' }];
  const env = {
    localStorage: { getItem: (key: string) => (key === 'settings-storage' ? stored : null) },
    window: { matchMedia: (query: string) => ({ matches: query === '(prefers-color-scheme: dark)' && osDark }) },
    document: {
      body: { classList: { add: (name: string) => classes.add(name) } },
      querySelectorAll: () => metas.map((meta) => ({ setAttribute: (_: string, value: string) => (meta.value = value) })),
    },
  };
  new Function('localStorage', 'window', 'document', script)(env.localStorage, env.window, env.document);
  return { dark: classes.has('dark'), metas: metas.map((meta) => meta.value) };
}

const persisted = (darkMode?: boolean) => JSON.stringify({ state: { darkMode, mapStyle: '' }, version: 2 });

test('index.html has the theme script before #root', () => {
  expect(script).toContain('settings-storage');
  expect(html.indexOf(script)).toBeLessThan(html.indexOf('<div id="root">'));
});

test('a persisted choice wins over the OS', () => {
  expect(run(persisted(true), false)).toEqual({ dark: true, metas: [THEME_COLOR.dark, THEME_COLOR.dark] });
  expect(run(persisted(false), true)).toEqual({ dark: false, metas: [THEME_COLOR.light, THEME_COLOR.light] });
});

test('automatic (or nothing stored, or garbage) follows the OS', () => {
  expect(run(persisted(undefined), true).dark).toBe(true);
  expect(run(null, true).dark).toBe(true);
  expect(run(null, false)).toEqual({ dark: false, metas: [THEME_COLOR.light, THEME_COLOR.light] });
  expect(run('{not json', true).dark).toBe(true);
});
