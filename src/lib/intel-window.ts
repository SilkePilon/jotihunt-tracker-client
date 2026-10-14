import { isAxiosError } from 'axios';
import type { Variants } from 'motion/react';
import { EASE_OUT } from '@/lib/motion';
import type { Article } from '@/types/Article';
import type { HintBoard, HintCell, RdPreview } from '@/types/HintCell';
import type { AreaState, Assignment, AssignmentStatus, DayGroup, IntelItem, IntelKind, IntelTab, ReadState } from '@/types/Intel';
import { areaOptions } from '@/lib/utils';

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = { open: 'Open', busy: 'Bezig', submitted: 'Ingeleverd', skipped: 'Skip' };

export const KIND_COLOR: Record<IntelKind, string> = { hint: '#fb923c', assignment: '#60a5fa', news: '#c084fc' };
export const KIND_LABEL: Record<IntelKind, string> = { hint: 'Hint', assignment: 'Opdracht', news: 'Nieuws' };

const AREAS = areaOptions.map((area) => area.value);
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const time = (date: unknown) => new Date(date as string).getTime();
const iso = (date: unknown) => (date ? new Date(date as string).toISOString() : undefined);
const kindOf = (type: string): IntelKind => (type === 'hint' || type === 'assignment' ? type : 'news');

/** Every article newest first, joined with its hint cells, assignment bookkeeping and read state */
export function buildIntelItems({ articles, board, assignments, readState }: { articles?: Article[]; board?: HintBoard; assignments?: Assignment[]; readState?: ReadState }): IntelItem[] {
  const read = new Set(readState?.read ?? []);
  const byArticle = new Map((assignments ?? []).map((assignment) => [assignment.articleId, assignment]));
  return [...(articles ?? [])]
    .sort((a, b) => time(b.publishAt) - time(a.publishAt))
    .map((article) => {
      const kind = kindOf(article.type);
      return {
        id: article.id,
        kind,
        title: article.title,
        publishAt: iso(article.publishAt) ?? '',
        content: article.content,
        summary: article.summary || undefined,
        cells: kind === 'hint' ? (board?.cells ?? []).filter((cell) => cell.articleId === article.id) : [],
        endTime: kind === 'assignment' ? iso(article.endTime) : undefined,
        maxPoints: kind === 'assignment' ? (article.maxPoints ?? undefined) : undefined,
        assignment: kind === 'assignment' ? byArticle.get(article.id) : undefined,
        unread: kind !== 'hint' && !read.has(article.id),
        readBy: readState?.readBy[String(article.id)] ?? [],
      };
    });
}

export function filterByTab(items: IntelItem[], tab: IntelTab): IntelItem[] {
  return tab === 'all' ? items : items.filter((item) => item.kind === tab);
}

export function unreadCount(items: IntelItem[]): number {
  return items.filter((item) => item.unread).length;
}

const dayKey = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' });
const dayName = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'long', day: 'numeric', month: 'short' });

/** "zaterdag 17 okt" (Intl gives "zaterdag 17 okt."; the dot goes) */
const dayLabel = (date: number) => dayName.format(date).replace(/\.$/, '');

/** Items (already sorted) per Dutch calendar day; today and yesterday are named */
export function groupByDay(items: IntelItem[], now: number): DayGroup[] {
  const today = dayKey.format(now);
  const yesterday = dayKey.format(now - DAY_MS);
  const groups: DayGroup[] = [];
  for (const item of items) {
    const date = time(item.publishAt);
    const key = dayKey.format(date);
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      const prefix = key === today ? 'Vandaag · ' : key === yesterday ? 'Gisteren · ' : '';
      group = { key, label: `${prefix}${dayLabel(date)}`, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

/** Per area (in the fixed area order): solved, open, none (no hint for that area) or missing (no cell) */
export function areaStates(cells: HintCell[]): Record<string, AreaState> {
  const byArea = new Map(cells.map((cell) => [cell.area, cell]));
  return Object.fromEntries(AREAS.map((area) => {
    const cell = byArea.get(area);
    return [area, cell ? (cell.status === 'solved' ? 'solved' : cell.status === 'none' ? 'none' : 'open') : 'missing'];
  }));
}

export function solvedCount(cells: HintCell[]): { solved: number; total: number } {
  const relevant = cells.filter((cell) => cell.status !== 'none');
  return { solved: relevant.filter((cell) => cell.status === 'solved').length, total: relevant.length };
}

/** The first open area (in area order), or the first one after `after` (wrapping around, never `after` itself) */
export function nextOpenArea(cells: HintCell[], after?: string | null): string | null {
  const states = areaStates(cells);
  const start = after ? AREAS.indexOf(after) + 1 : 0;
  const order = [...AREAS.slice(start), ...AREAS.slice(0, start)].filter((area) => area !== after);
  return order.find((area) => states[area] === 'open') ?? null;
}

/** "nog 42 min", "nog 1 u 47" or "verlopen" */
export function deadlineLabel(endTime: string, now: number): string {
  const left = time(endTime) - now;
  if (left <= 0) return 'verlopen';
  const minutes = Math.ceil(left / 60_000);
  return minutes < 60 ? `nog ${minutes} min` : `nog ${Math.floor(minutes / 60)} u ${minutes % 60}`;
}

export function isDeadlineUrgent(endTime: string | undefined, now: number, status: AssignmentStatus): boolean {
  if (!endTime || status === 'submitted' || status === 'skipped') return false;
  const left = time(endTime) - now;
  return left > 0 && left < HOUR_MS;
}

/** The solve was refused because another hint marker exists for that area and hour */
export function hasExistingMarker(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 409 && !!(error.response.data as { existingMarkerId?: string } | undefined)?.existingMarkerId;
}

/** The rough RD box of the game area: a parsed answer outside it is most likely a typo (digits swapped, x and y swapped) */
const GAME_AREA_RD = { minX: 130_000, maxX: 260_000, minY: 400_000, maxY: 520_000 };

/** The line under a hint's answer field: a coordinate (inside or outside the game area), a text answer, or nothing (empty) */
export type AnswerPreview = { kind: 'rd'; rd: RdPreview } | { kind: 'outside'; rd: RdPreview } | { kind: 'text' } | null;

/** Classify a typed answer from its server-parsed RD coordinate (`rd`, null when it is not a coordinate) */
export function answerPreview(answer: string, rd: RdPreview | null): AnswerPreview {
  if (!answer.trim()) return null;
  if (!rd) return { kind: 'text' };
  const outside = rd.x < GAME_AREA_RD.minX || rd.x > GAME_AREA_RD.maxX || rd.y < GAME_AREA_RD.minY || rd.y > GAME_AREA_RD.maxY;
  return { kind: outside ? 'outside' : 'rd', rd };
}

/**
 * Split view, right side (T1). The keyed detail wrapper uses `DETAIL_SWAP` with `initial="open"` (the split opens: its parts
 * are pushed in from the right while the timeline shrinks) or `initial="swap"` (another item: parts rise in), `animate="shown"`,
 * `exit="gone"` and `custom={swap}`; every top-level part of the detail is a motion element with `variants={DETAIL_PART}`.
 */
export const DETAIL_SWAP: Variants = {
  open: {},
  swap: {},
  shown: (swap: boolean) => ({ transition: swap ? { staggerChildren: 0.045 } : { staggerChildren: 0.055, delayChildren: 0.15 } }),
  gone: { opacity: 0, transition: { duration: 0.11, ease: 'easeIn' } },
};
export const DETAIL_PART: Variants = {
  open: { opacity: 0, x: 28 },
  swap: { opacity: 0, y: 10 },
  shown: { opacity: 1, x: 0, y: 0, transition: { duration: 0.38, ease: EASE_OUT } },
};
