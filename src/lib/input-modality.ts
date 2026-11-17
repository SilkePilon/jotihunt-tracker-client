/** How the user last interacted: a key press, or a pointer (mouse, touch, pen). */
export type InputModality = 'keyboard' | 'pointer';

/** The modality after an input event; other events (and lone modifier keys) keep the current one. */
export function nextModality(current: InputModality, event: { type: string; key?: string }): InputModality {
  if (event.type === 'pointerdown') return 'pointer';
  if (event.type === 'keydown' && !['Shift', 'Control', 'Alt', 'Meta'].includes(event.key ?? '')) return 'keyboard';
  return current;
}

let modality: InputModality = 'pointer';
if (typeof document !== 'undefined') {
  const track = (event: KeyboardEvent | PointerEvent) => {
    modality = nextModality(modality, { type: event.type, key: 'key' in event ? event.key : undefined });
  };
  // Capture phase: before any handler acts on the event (a list item that opens a popup on Enter)
  document.addEventListener('keydown', track, true);
  document.addEventListener('pointerdown', track, true);
}

/**
 * Whether the activation being handled came from the keyboard (Enter/Space on a list item, cmdk or menu item, whose
 * onSelect gets no event): then e.g. the popup it opens takes focus.
 */
export function activatedByKeyboard(): boolean {
  return modality === 'keyboard';
}
