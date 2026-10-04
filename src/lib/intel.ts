import { isAxiosError } from 'axios';
import type { Article } from '@/types/Article';
import type { HintBoard } from '@/types/HintCell';
import type { Assignment, AssignmentStatus, IntelFilter, IntelItem, IntelType, PresenceEntry, ReadState, Selection, WriteConflict, WriteFlags } from '@/types/Intel';

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = { open: 'Open', busy: 'Bezig', submitted: 'Ingeleverd', skipped: 'Skip' };

const typeOf = (type: string): IntelType => (type === 'hint' || type === 'assignment' ? type : 'news');
const time = (date: unknown) => new Date(date as string).getTime();
const iso = (date: unknown) => (date ? new Date(date as string).toISOString() : undefined);

/** The rows of the hints page: every article, newest first, joined with hint cells, assignment bookkeeping and read state */
export function buildIntelItems({ articles, board, assignments, readState }: { articles?: Article[]; board?: HintBoard; assignments?: Assignment[]; readState?: ReadState }): IntelItem[] {
  const read = new Set(readState?.read ?? []);
  const byArticle = new Map((assignments ?? []).map((assignment) => [assignment.articleId, assignment]));
  return [...(articles ?? [])]
    .sort((a, b) => time(b.publishAt) - time(a.publishAt))
    .map((article) => {
      const type = typeOf(article.type);
      return {
        id: article.id,
        type,
        title: article.title,
        publishAt: iso(article.publishAt) ?? '',
        content: article.content,
        cells: type === 'hint' ? (board?.cells ?? []).filter((cell) => cell.articleId === article.id) : [],
        endTime: type === 'assignment' ? iso(article.endTime) : undefined,
        maxPoints: type === 'assignment' ? (article.maxPoints ?? undefined) : undefined,
        assignment: type === 'assignment' ? byArticle.get(article.id) : undefined,
        summary: article.summary || undefined,
        summaryPoints: article.summaryPoints ?? [],
        unread: type !== 'hint' && !read.has(article.id),
        readBy: readState?.readBy[String(article.id)] ?? 0,
      };
    });
}

/**
 * Whether an item still needs attention: unsolved hint cells, an assignment not handed in or skipped, unread news.
 * A hint without cells (the board still loads) counts as open, so it does not drop out of the "open" filter meanwhile.
 */
export function isOpenItem(item: IntelItem): boolean {
  if (item.type === 'hint') return item.cells.length === 0 || item.cells.some((cell) => cell.status === 'open' || cell.status === 'solving');
  if (item.type === 'assignment') return !item.assignment || item.assignment.status === 'open' || item.assignment.status === 'busy';
  return item.unread;
}

/** How many items there are in total and per type, for the filter chips */
export function intelCounts(items: IntelItem[]): Record<IntelType | 'all', number> {
  const counts = { all: items.length, hint: 0, assignment: 0, news: 0 };
  for (const item of items) counts[item.type]++;
  return counts;
}

const plainText = (html: string) => html.replace(/<[^>]+>/g, ' ');

/** The items that pass the filter: the type, "only open", and the query in the title, summary or text (tags and repeated spaces ignored) */
export function filterIntelItems(items: IntelItem[], filter: IntelFilter): IntelItem[] {
  const query = filter.query.trim().toLowerCase().replace(/\s+/g, ' ');
  return items.filter((item) => {
    if (filter.type !== 'all' && item.type !== filter.type) return false;
    if (filter.openOnly && !isOpenItem(item)) return false;
    if (!query) return true;
    return `${item.title} ${item.summary ?? ''} ${plainText(item.content)}`.toLowerCase().replace(/\s+/g, ' ').includes(query);
  });
}

/** How pressing a deadline is; 'done' when the assignment was handed in or skipped, 'none' without a deadline */
export type DeadlineTone = 'none' | 'done' | 'late' | 'urgent' | 'soon';

const HOUR_MS = 60 * 60 * 1000;

/** How pressing an assignment's deadline is */
export function deadlineTone(endTime: string | undefined, now: number, status: AssignmentStatus): DeadlineTone {
  if (status === 'submitted' || status === 'skipped') return 'done';
  if (!endTime) return 'none';
  const left = time(endTime) - now;
  if (left <= 0) return 'late';
  return left < HOUR_MS ? 'urgent' : 'soon';
}

/** "nog 42 min", "nog 1 u 47" or "verlopen" */
export function deadlineLabel(endTime: string, now: number): string {
  const left = time(endTime) - now;
  if (left <= 0) return 'verlopen';
  const minutes = Math.ceil(left / 60_000);
  return minutes < 60 ? `nog ${minutes} min` : `nog ${Math.floor(minutes / 60)} u ${minutes % 60}`;
}

/** The other users who have an item open; with `area` only those on that area of a hint */
export function othersOnItem(entries: PresenceEntry[] | undefined, itemId: number, selfId: string | undefined, area?: string): PresenceEntry[] {
  return (entries ?? []).filter((entry) => entry.itemId === itemId && entry.userId !== selfId && (area === undefined || entry.area === area));
}

const conflictBody = (error: unknown) => (isAxiosError(error) && error.response?.status === 409 ? (error.response.data as { conflict?: WriteConflict; existingMarkerId?: string } | undefined) : undefined);

/** The conflict of a 409 answer to a guarded write, or null */
export function conflictOf(error: unknown): WriteConflict | null {
  return conflictBody(error)?.conflict ?? null;
}

/** The 409 of a solve when another hint marker already stands at that area and hour */
export function hasExistingMarker(error: unknown): boolean {
  return !!conflictBody(error)?.existingMarkerId;
}

/** What follows a failed guarded write: a question to the user with the flags to repeat it with, or an error */
export type WriteStep = { ask: 'conflict'; conflict: WriteConflict; flags: WriteFlags } | { ask: 'marker'; conflict: null; flags: WriteFlags } | { ask: 'error' };

/** What to do after a guarded write failed: ask the user (and with which flags to repeat it), or show the error */
export function nextWriteStep(error: unknown, flags: WriteFlags): WriteStep {
  const conflict = conflictOf(error);
  if (conflict && !flags.overwrite) return { ask: 'conflict', conflict, flags: { ...flags, overwrite: true } };
  if (hasExistingMarker(error) && !flags.replaceMarker) return { ask: 'marker', conflict: null, flags: { ...flags, replaceMarker: true } };
  return { ask: 'error' };
}

const CONFLICT_TEXT: Record<WriteConflict['kind'], { title: string; did: string; confirm: string }> = {
  answer: { title: 'Antwoord overschrijven?', did: 'heeft dit vak al opgelost', confirm: 'Overschrijven' },
  claim: { title: 'Vak overnemen?', did: 'is met dit vak bezig', confirm: 'Overnemen' },
  status: { title: 'Status overschrijven?', did: 'heeft de status al gezet', confirm: 'Overschrijven' },
  owner: { title: 'Opdracht overnemen?', did: 'heeft deze opdracht al toegewezen', confirm: 'Overnemen' },
};

/** The texts of the overwrite dialog for a conflict */
export function conflictText(conflict: WriteConflict): { title: string; description: string; confirm: string } {
  const text = CONFLICT_TEXT[conflict.kind];
  return { title: text.title, description: `${conflict.by?.name ?? 'Iemand anders'} ${text.did}.`, confirm: text.confirm };
}

/** Great-circle distance between two [lng, lat] points, in whole metres */
export function distanceMeters(a: [number, number], b: [number, number]): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(h)));
}

/** The selected item (and hint area) from the page's query string; `article` is the parameter of old links */
export function parseSelection(params: URLSearchParams): Selection {
  const itemId = Number(params.get('item') ?? params.get('article'));
  if (!Number.isInteger(itemId) || itemId <= 0) return {};
  const area = params.get('area')?.toLowerCase();
  return area ? { itemId, area } : { itemId };
}

/** The query string (with its "?") that selects an item and, for a hint, an area; empty without an item */
export function selectionSearch(itemId?: number, area?: string): string {
  if (itemId === undefined) return '';
  return `?item=${itemId}${area ? `&area=${area}` : ''}`;
}
