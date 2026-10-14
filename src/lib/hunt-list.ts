import { formatCountdown } from '@/lib/format';
import { currentHuntStatus, isReading } from '@/lib/hunt-reports';
import { areaOptions } from '@/lib/utils';
import type { Hunt } from '@/types/Hunt';
import type { HuntListItem, HuntReport } from '@/types/HuntReport';

/** The status filters of "Alle hunts" (nav items, in order). */
export type HuntFilter = 'all' | 'pending' | 'submitted' | 'judged';
export const HUNT_FILTERS: HuntFilter[] = ['all', 'pending', 'submitted', 'judged'];
export const HUNT_FILTER_LABELS: Record<HuntFilter, string> = { all: 'Alles', pending: 'Te versturen', submitted: 'Ingestuurd', judged: 'Beoordeeld' };

/** Website-only hunts are already judged on jotihunt.nl, so they only show under Alles and Beoordeeld. */
export function matchesHuntFilter(item: HuntListItem, filter: HuntFilter): boolean {
  if (filter === 'all') return true;
  if (item.source === 'website') return filter === 'judged';
  const status = item.report.status;
  if (filter === 'pending') return status === 'to_submit' || status === 'overdue';
  return status === filter;
}

export const huntItemKey = (item: HuntListItem) => (item.source === 'app' ? item.report._id : `site-${item.hunt._id}`);
export const huntItemArea = (item: HuntListItem) => (item.source === 'app' ? item.report.area : item.hunt.area).trim().toLowerCase();
export const huntItemPoints = (item: HuntListItem) => (item.source === 'app' ? (item.report.site?.points ?? 0) : item.hunt.points);

export function huntFilterCounts(items: HuntListItem[]): Record<HuntFilter, number> {
  return Object.fromEntries(HUNT_FILTERS.map((filter) => [filter, items.filter((item) => matchesHuntFilter(item, filter)).length])) as Record<HuntFilter, number>;
}

export interface HuntAreaTotal {
  /** Lowercase area name, e.g. "alpha" */
  area: string;
  label: string;
  count: number;
  points: number;
}

/** Hunts and points per area, in area order; areas without hunts are left out. */
export function huntAreaTotals(items: HuntListItem[]): HuntAreaTotal[] {
  return areaOptions
    .map((option) => {
      const inArea = items.filter((item) => huntItemArea(item) === option.value);
      return { area: option.value, label: option.label, count: inArea.length, points: inArea.reduce((sum, item) => sum + huntItemPoints(item), 0) };
    })
    .filter((total) => total.count > 0);
}

/** Colour of the status text in a row's meta line; `rejected` = judged without points. */
export type HuntRowTone = 'to_submit' | 'overdue' | 'submitted' | 'judged' | 'rejected';

export interface HuntRowStatus {
  tone: HuntRowTone;
  /** "Te versturen · 8:42", "Te laat!", "Ingestuurd", or the jotihunt.nl status ("Goedgekeurd") */
  text: string;
  /** Less than 5 minutes left to submit: the text pulses */
  urgent: boolean;
}

const URGENT_MS = 5 * 60_000;

/** Status at the start of a row's meta line; null while the photo is being read (the title shows "Wordt gelezen…"). */
export function huntRowStatus(report: HuntReport, now: number): HuntRowStatus | null {
  if (isReading(report)) return null;
  switch (currentHuntStatus(report, now)) {
    case 'to_submit': {
      const left = new Date(report.deadline).getTime() - now;
      return { tone: 'to_submit', text: `Te versturen · ${formatCountdown(left)}`, urgent: left < URGENT_MS };
    }
    case 'overdue':
      return { tone: 'overdue', text: 'Te laat!', urgent: false };
    case 'submitted':
      return { tone: 'submitted', text: 'Ingestuurd', urgent: false };
    case 'judged':
      return { tone: report.site?.points ? 'judged' : 'rejected', text: report.site?.status || 'Beoordeeld', urgent: false };
  }
}

export function websiteHuntStatus(hunt: Hunt): HuntRowStatus {
  return { tone: hunt.points ? 'judged' : 'rejected', text: hunt.status || 'Beoordeeld', urgent: false };
}

/** Amber word at the end of the meta line: HQ should check this report. */
export function huntRowFlag(report: HuntReport): 'controleren' | 'dubbel?' | null {
  if (report.needsReview && !isReading(report)) return 'controleren';
  if (report.duplicateOf) return 'dubbel?';
  return null;
}

export const HUNT_ROW_TONE_CLASS: Record<HuntRowTone, string> = {
  to_submit: 'text-amber-700 dark:text-amber-300',
  overdue: 'text-red-700 dark:text-red-300',
  submitted: 'text-blue-700 dark:text-blue-300',
  judged: 'text-green-700 dark:text-green-400',
  rejected: 'text-red-700 dark:text-red-300',
};
