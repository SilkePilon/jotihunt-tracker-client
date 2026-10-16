import { isAxiosError } from 'axios';
import type { TargetAndTransition, Transition, Variants } from 'motion/react';
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
  const read = new Set(Array.isArray(readState?.read) ? readState.read : []);
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
        // An older server sends a count instead of the names
        readBy: namesOf(readState?.readBy?.[String(article.id)]),
      };
    });
}

const namesOf = (value: unknown): string[] => (Array.isArray(value) ? value : []);

export function filterByTab(items: IntelItem[], tab: IntelTab): IntelItem[] {
  return tab === 'all' ? items : items.filter((item) => item.kind === tab);
}

/** Unread items, optionally of one kind only */
export function unreadCount(items: IntelItem[], kind?: IntelKind): number {
  return items.filter((item) => item.unread && (!kind || item.kind === kind)).length;
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

/**
 * The area a hint opens on: the requested one (mini grid) if this hint has a cell there (also a "geen hint" one: the
 * split can be wrong, so it can still be answered), else none: opened from the timeline, every area starts closed
 */
export function initialOpenArea(cells: HintCell[], area: string | null): string | null {
  const cell = area ? cells.find((existing) => existing.area === area) : undefined;
  return cell ? cell.area : null;
}

/** "nog 42 min", "nog 1 u 05" or "verlopen" */
export function deadlineLabel(endTime: string, now: number): string {
  const left = time(endTime) - now;
  if (left <= 0) return 'verlopen';
  const minutes = Math.ceil(left / 60_000);
  return minutes < 60 ? `nog ${minutes} min` : `nog ${Math.floor(minutes / 60)} u ${String(minutes % 60).padStart(2, '0')}`;
}

export function isDeadlineUrgent(endTime: string | undefined, now: number, status: AssignmentStatus): boolean {
  if (!endTime || status === 'submitted' || status === 'skipped') return false;
  const left = time(endTime) - now;
  return left > 0 && left < HOUR_MS;
}

/** How a deadline pill looks: done (submitted or skipped), expired, urgent (under an hour left) or calm */
export type DeadlineTone = 'done' | 'expired' | 'urgent' | 'calm';

export function deadlineTone(endTime: string, now: number, status: AssignmentStatus): DeadlineTone {
  if (status === 'submitted' || status === 'skipped') return 'done';
  if (time(endTime) - now <= 0) return 'expired';
  return isDeadlineUrgent(endTime, now, status) ? 'urgent' : 'calm';
}

/** The solve was refused because another hint marker exists for that area and hour */
export function hasExistingMarker(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 409 && !!(error.response.data as { existingMarkerId?: string } | undefined)?.existingMarkerId;
}

/** The rough RD box of the game area: a parsed answer outside it is most likely a typo (digits swapped, x and y swapped) */
const GAME_AREA_RD = { minX: 130_000, maxX: 260_000, minY: 400_000, maxY: 520_000 };

/** The line under a hint's answer field: a coordinate (inside or outside the game area), a text answer, or nothing (empty) */
export type AnswerPreview = { kind: 'rd'; rd: RdPreview } | { kind: 'outside'; rd: RdPreview } | { kind: 'invalid' } | { kind: 'text' } | null;

/** Two groups of 4–6 digits (space, comma, semicolon or slash between): meant as a coordinate */
const COORDINATE_LIKE = /^\d{4,6}[\s,;/]+\d{4,6}$/;

/**
 * Classify a typed answer from its server-parsed RD coordinate (`rd`, null when it is not a coordinate). Something that
 * looks like a coordinate but doesn't parse (the server refuses out-of-range RD, e.g. swapped digits) is `invalid`.
 */
export function answerPreview(answer: string, rd: RdPreview | null): AnswerPreview {
  const trimmed = answer.trim();
  if (!trimmed) return null;
  if (!rd) return COORDINATE_LIKE.test(trimmed) ? { kind: 'invalid' } : { kind: 'text' };
  const outside = rd.x < GAME_AREA_RD.minX || rd.x > GAME_AREA_RD.maxX || rd.y < GAME_AREA_RD.minY || rd.y > GAME_AREA_RD.maxY;
  return { kind: outside ? 'outside' : 'rd', rd };
}

/** Tab order left to right: a tab further right pushes the list in from the right */
export const INTEL_TAB_ORDER: IntelTab[] = ['all', 'hint', 'assignment', 'news'];

/** Bars in the oplos-tempo chart */
export const SOLVE_CHART_SLOTS = 8;

/** One hint slot in the oplos-tempo chart */
export interface SlotBar {
  /** ISO */
  slotTime: string;
  /** "18" (Dutch time) */
  hour: string;
  solved: number;
  open: number;
}

/** Everything the status card shows */
export interface IntelStats {
  /** Cells with a hint (not "geen hint"); percent is null without any */
  hints: { solved: number; total: number; percent: number | null };
  /** Submitted assignments and the max points of those */
  assignments: { submitted: number; total: number; points: number };
  unread: { news: number; assignment: number };
  /** The last SOLVE_CHART_SLOTS hint slots, oldest first */
  slots: SlotBar[];
  /** Mean time from publish to first solve over the solved cells of those slots that have a solvedAt, or null */
  avgSolveMs: number | null;
}

const hourFormat = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', hourCycle: 'h23' });

export function intelStats(items: IntelItem[], cells: HintCell[]): IntelStats {
  const counted = cells.filter((cell) => cell.status !== 'none');
  const solved = counted.filter((cell) => cell.status === 'solved').length;

  const assignments = items.filter((item) => item.kind === 'assignment');
  const submitted = assignments.filter((item) => item.assignment?.status === 'submitted');

  // Per slot (normalised ISO, so differently formatted dates of one slot meet), newest SOLVE_CHART_SLOTS kept
  const bySlot = new Map<string, HintCell[]>();
  for (const cell of counted) {
    const key = new Date(cell.slotTime).toISOString();
    bySlot.set(key, [...(bySlot.get(key) ?? []), cell]);
  }
  const keys = [...bySlot.keys()].sort((a, b) => time(a) - time(b)).slice(-SOLVE_CHART_SLOTS);
  const slots = keys.map((slotTime) => {
    const slotCells = bySlot.get(slotTime)!;
    const solvedHere = slotCells.filter((cell) => cell.status === 'solved').length;
    return { slotTime, hour: hourFormat.format(time(slotTime)), solved: solvedHere, open: slotCells.length - solvedHere };
  });

  const durations = keys
    .flatMap((key) => bySlot.get(key)!)
    .filter((cell) => cell.status === 'solved' && cell.solvedAt)
    .map((cell) => time(cell.solvedAt) - time(cell.publishAt))
    .filter((ms) => ms >= 0);

  return {
    hints: { solved, total: counted.length, percent: counted.length ? Math.round((solved / counted.length) * 100) : null },
    assignments: { submitted: submitted.length, total: assignments.length, points: submitted.reduce((sum, item) => sum + (item.maxPoints ?? 0), 0) },
    unread: { news: unreadCount(items, 'news'), assignment: unreadCount(items, 'assignment') },
    slots,
    avgSolveMs: durations.length ? durations.reduce((sum, ms) => sum + ms, 0) / durations.length : null,
  };
}

/** "18 min", or "1 u 05" from 90 minutes on */
export function formatSolveTime(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  return minutes < 90 ? `${minutes} min` : `${Math.floor(minutes / 60)} u ${String(minutes % 60).padStart(2, '0')}`;
}

/** The Ongelezen tile's sub line */
export function unreadLabel({ news, assignment }: { news: number; assignment: number }): string {
  const assignments = assignment === 1 ? 'opdracht' : 'opdrachten';
  if (news && assignment) return `nieuws · ${assignment} ${assignments}`;
  if (assignment) return assignments;
  return news ? 'nieuws' : 'alles gelezen';
}

/** Where the Ongelezen tile leads: Opdrachten when only assignments are unread, else Nieuws */
export function unreadTab({ news, assignment }: { news: number; assignment: number }): IntelTab {
  return assignment && !news ? 'assignment' : 'news';
}

/** Views and items push sideways (timeline ↔ item, item ↔ item): 1 = forward (in from the right), -1 = back */
export const PUSH_TRANSITION: Transition = { duration: 0.36, ease: EASE_OUT };
export const PUSH: Variants = {
  enter: (direction: number) => ({ x: `${35 * direction}%`, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: PUSH_TRANSITION },
  exit: (direction: number) => ({ x: `${-35 * direction}%`, opacity: 0, transition: PUSH_TRANSITION }),
};

/** A chat message rising in (streaming text itself is not animated per token) */
export const CHAT_MESSAGE = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, transition: { duration: 0.15 } },
  transition: { duration: 0.3, ease: EASE_OUT },
} satisfies { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition; transition: Transition };

/** Prompt box toggles: the icon turns once and grows a little when switched on */
export const TOGGLE_SPRING: Transition = { type: 'spring', stiffness: 260, damping: 25 };

/** The chat's empty state: its parts stagger in 70 ms apart; custom = delay in seconds before the first */
export const CHAT_EMPTY: Variants = {
  hidden: {},
  shown: (delay: number = 0) => ({ transition: { staggerChildren: 0.07, delayChildren: delay } }),
};
export const CHAT_EMPTY_PART: Variants = {
  hidden: { opacity: 0, y: 8 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } },
};

/** The intel window's close animation: "Toon op kaart" flies only once the map is in view again */
export const INTEL_CLOSE_MS = 260;

/** The ✦ in the chat header spins in after the view push (item opened from the timeline) */
export const CHAT_SPARK = {
  initial: { rotate: -120, scale: 0.4, opacity: 0 },
  animate: { rotate: 0, scale: 1, opacity: 1 },
  transition: { type: 'spring', stiffness: 260, damping: 14, delay: 0.3 },
} satisfies { initial: TargetAndTransition; animate: TargetAndTransition; transition: Transition };

/** The empty state's parts start after the view push and the ✦ (item opened from the timeline) */
export const CHAT_EMPTY_ENTRANCE_DELAY = 0.45;
