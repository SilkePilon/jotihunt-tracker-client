/** The browser chrome colour (<meta name="theme-color">) per app theme: the page background (index.css --background). */
export const THEME_COLOR = { light: '#ffffff', dark: '#1a1a1e' } as const;

export function themeColor(dark: boolean): string {
  return dark ? THEME_COLOR.dark : THEME_COLOR.light;
}

/**
 * Point every theme-color meta at the active app theme. index.html has one per OS colour scheme (for the first paint);
 * the app's own toggle can differ from the OS, so both get the active colour.
 */
export function syncThemeColor(dark: boolean, doc: Document = document): void {
  for (const meta of doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) meta.content = themeColor(dark);
}
