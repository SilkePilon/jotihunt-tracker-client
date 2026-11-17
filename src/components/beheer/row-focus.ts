import { neighbourIndex } from '@/lib/focus';

/** Focus moves for Beheer rows (RowFrame) that go away; DOM-only, so they live outside the component file. */

/** Focuses a card's heading (its toggle when it has one); false when the card is gone. */
export function focusCardHeading(section: Element | null): boolean {
  const heading = section?.isConnected ? section.querySelector<HTMLElement>('[data-card-heading]') : null;
  heading?.focus();
  return !!heading;
}

/**
 * Focus leaves a row that goes away after a dialog closes (e.g. a revoke confirmed in a ConfirmDialog, whose focus
 * return would land on the removed row): the next row, else the previous one, else the heading of `card`, the row's
 * card section captured while the row was still there. Call it from the dialog's onCloseAutoFocus (preventDefault first).
 */
export function focusAwayFromRow(element: HTMLElement | null, card: Element | null) {
  const frame = element?.isConnected ? element.closest<HTMLElement>('[data-row-frame]') : null;
  if (frame) focusNeighbourRow(frame);
  else focusCardHeading(card);
}

/** A row that holds focus goes away: focus the next row's header (or first control), else the previous one's, else the card heading. */
export function focusNeighbourRow(frame: HTMLElement) {
  const frames = Array.from(frame.parentElement?.children ?? []);
  const targets = frames.map((row) =>
    row instanceof HTMLElement && row !== frame && row.dataset.exiting === undefined
      ? row.querySelector<HTMLElement>('[data-row-header], button:not(:disabled), a[href], input:not(:disabled)')
      : null,
  );
  const index = neighbourIndex(targets.map(Boolean), frames.indexOf(frame));
  if (index >= 0) targets[index]?.focus();
  else focusCardHeading(frame.closest('section'));
}
