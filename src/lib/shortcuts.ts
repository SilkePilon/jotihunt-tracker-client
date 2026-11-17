/** Laptop keyboard shortcuts on the map page (Layout.tsx): "/" the group search, "i" the Intel window. */

export type Shortcut = 'search' | 'intel';

/** The parts of a keydown that decide it */
export type ShortcutKey = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'repeat' | 'isComposing' | 'defaultPrevented'>;

/** What may be open or focused instead */
export interface ShortcutContext {
  /** Focus is in a text field (input, textarea, select, contenteditable) */
  typing: boolean;
  /** A dialog, drawer, popover, menu or the tour is open */
  layerOpen: boolean;
}

/**
 * The shortcut a key press means, or null. Never while typing or composing (IME), with a layer open, held down, or
 * with Ctrl/Cmd/Alt (browser and OS shortcuts). Shift is fine for "/": some layouts need it to type one.
 */
export function shortcutFor(event: ShortcutKey, { typing, layerOpen }: ShortcutContext): Shortcut | null {
  if (event.defaultPrevented || event.isComposing || event.key === 'Process' || event.repeat) return null;
  if (event.ctrlKey || event.metaKey || event.altKey || typing || layerOpen) return null;
  if (event.key === '/') return 'search';
  if (event.key === 'i' && !event.shiftKey) return 'intel';
  return null;
}

/** Focus targets that take text: a shortcut key there is typed, not a shortcut */
export const TYPING_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/** Open layers that own the keyboard: Radix dialogs/drawers/popovers, alert dialogs, menus, listboxes, the tour */
export const LAYER_SELECTOR = '[role="dialog"][data-state="open"], [role="alertdialog"], [aria-modal="true"], [role="menu"], [role="listbox"]';
