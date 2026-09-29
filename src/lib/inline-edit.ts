/**
 * For the surrounding dialog's `onEscapeKeyDown`: Escape inside an inline editor cancels the edit instead of closing
 * the dialog.
 */
export function keepOpenWhileEditing(event: KeyboardEvent) {
  if (document.activeElement instanceof HTMLElement && document.activeElement.dataset.inlineEdit !== undefined) event.preventDefault();
}
