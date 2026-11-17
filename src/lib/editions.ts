import { isAxiosError } from 'axios';

export type EditionView = { year: number; live: boolean; shown: boolean; huntStart: string | null; huntEnd: string | null; hunts: number; points: number | null };
export type EditionsState = { editions: EditionView[]; liveYear: number; shownYear: number; readOnly: boolean };

const DAY = new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', timeZone: 'Europe/Amsterdam' });
const MONTH = new Intl.DateTimeFormat('nl-NL', { month: 'short', timeZone: 'Europe/Amsterdam' });
const NUMBER = new Intl.NumberFormat('nl-NL');

/** "za 17 – zo 18 okt" */
function huntDates(start: string, end: string): string {
  const clean = (s: string) => s.replace('.', '');
  return `${clean(DAY.format(new Date(start)))} – ${clean(DAY.format(new Date(end)))} ${clean(MONTH.format(new Date(end)))}`;
}

const huntsText = (n: number) => `${NUMBER.format(n)} ${n === 1 ? 'hunt' : 'hunts'}`;

/** Grey meta line of an edition row: "Live · za 17 – zo 18 okt · 38 hunts" / "Archief · 38 hunts · 1.204 punten" */
export function editionMeta(edition: EditionView): string {
  if (edition.live) {
    const dates = edition.huntStart && edition.huntEnd ? [huntDates(edition.huntStart, edition.huntEnd)] : [];
    return ['Live', ...dates, huntsText(edition.hunts)].join(' · ');
  }
  const points = edition.points !== null ? [`${NUMBER.format(edition.points)} punten`] : [];
  return ['Archief', huntsText(edition.hunts), ...points].join(' · ');
}

/** The server refused a write because an archive edition is shown */
export function isArchiveError(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 423;
}

/** After "Editie gewijzigd" shows, the page reloads this much later (time to read it) */
export const EDITION_RELOAD_DELAY_MS = 2000;

/**
 * Pure: when to reload after another edition was shown at `changedAt`. 0 = now; a number = check again after that many
 * ms; null = not while the user is busy (a form page or a dialog / drawer is open): check again when that changes.
 */
export function editionReloadWait(changedAt: number, now: number, busy: boolean): number | null {
  if (busy) return null;
  return Math.max(0, changedAt + EDITION_RELOAD_DELAY_MS - now);
}
