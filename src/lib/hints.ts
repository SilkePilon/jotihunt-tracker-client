import DOMPurify from 'dompurify';
import type { HintArticle, HintBoard, HintCell } from '@/types/HintCell';

export const HINT_WINDOW_MS = 20 * 60 * 1000;

/**
 * Milliseconds left in the 20-minute scoring window of a hint.
 */
export function remainingMs(publishAt: string, now: number) {
  return new Date(publishAt).getTime() + HINT_WINDOW_MS - now;
}

/**
 * Format milliseconds as m:ss (rounded up, never negative).
 */
export function formatCountdown(ms: number) {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.ceil(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

/**
 * Sanitise Jotihunt article HTML before rendering it.
 */
export function sanitizeHintHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['div', 'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'span', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'img', 'a', 'figure', 'figcaption'],
    ALLOWED_ATTR: ['src', 'href', 'alt', 'width', 'height'],
  });
}

export interface HintRow {
  article: HintArticle;
  cells: Partial<Record<string, HintCell>>;
}

/**
 * The newest hint articles with their cells keyed by area.
 * @param board The hint board
 * @param count How many articles to return
 */
export function lastHintRows(board: HintBoard, count: number): HintRow[] {
  return [...board.articles]
    .sort((a, b) => new Date(b.publishAt).getTime() - new Date(a.publishAt).getTime())
    .slice(0, count)
    .map((article) => ({
      article,
      cells: Object.fromEntries(board.cells.filter((cell) => cell.articleId === article.id).map((cell) => [cell.area, cell])),
    }));
}

/**
 * Solved vs. total cells over the whole hunt, ignoring areas without a hint.
 */
export function hintProgress(board: HintBoard): { solved: number; total: number } {
  const relevant = board.cells.filter((cell) => cell.status !== 'none');
  return { solved: relevant.filter((cell) => cell.status === 'solved').length, total: relevant.length };
}
