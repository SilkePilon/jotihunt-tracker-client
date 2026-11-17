/**
 * A control busy with async work (saving, a passkey prompt): it looks disabled but stays focusable, so keyboard and
 * screen-reader users don't lose their place. `disabled` would drop the focus to <body> mid-action. The click handler
 * must still return early while busy (aria-disabled doesn't stop clicks or Enter). Keep `disabled` for controls that
 * can't act at all (no passkey support, empty form).
 */
export const BUSY_CLASSES = 'aria-disabled:pointer-events-none aria-disabled:opacity-50';

/** aria-disabled + aria-busy while busy; nothing otherwise (no `aria-busy="false"` noise) */
export function busyProps(busy: boolean): { 'aria-disabled': true | undefined; 'aria-busy': true | undefined } {
  return { 'aria-disabled': busy || undefined, 'aria-busy': busy || undefined };
}
