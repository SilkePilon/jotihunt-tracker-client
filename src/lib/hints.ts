import DOMPurify from 'dompurify';
import type { HintArticle, HintBoard, HintCell } from '@/types/HintCell';

/** Hint board polling: quickly while the intel window is open (answers by others must show up fast), slowly for the sidebar mini grid. */
export const HINT_BOARD_LIVE_REFRESH_MS = 3000;
export const HINT_BOARD_IDLE_REFRESH_MS = 10_000;

/**
 * How often to poll the hint board.
 * @param live Whether the intel window is open (fast); false for the sidebar mini grid (slow)
 */
export function hintBoardRefreshMs(live: boolean): number {
  return live ? HINT_BOARD_LIVE_REFRESH_MS : HINT_BOARD_IDLE_REFRESH_MS;
}

let hintPurifier: typeof DOMPurify | undefined;

/**
 * A DOMPurify instance of our own, so its hook does not run for other users of the shared one. Made on first use:
 * there is no `window` when this module is imported outside a browser (the unit tests).
 */
function getHintPurifier(): typeof DOMPurify {
  if (!hintPurifier) {
    hintPurifier = DOMPurify(window);
    // Runs after the attributes were filtered: `target` and `rel` are not allowed from the article, only as set here
    hintPurifier.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName !== 'A') return;
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    });
  }
  return hintPurifier;
}

/**
 * Sanitise Jotihunt article HTML before rendering it. Links open in a new tab, so a click does not leave the tracker.
 */
export function sanitizeHintHtml(html: string) {
  return getHintPurifier().sanitize(html, {
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
