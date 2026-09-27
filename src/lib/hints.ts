import DOMPurify from 'dompurify';

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
