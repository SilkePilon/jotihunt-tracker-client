import { minutesLeft } from '@/lib/counter-hunt';
import { formatClock } from '@/lib/format';
import type { HappyHourView } from '@/types/Telegram';

export const HAPPY_HOUR_POLL_MS = 30_000;
export const HAPPY_HOUR_POLL_NEAR_MS = 10_000;
/** Poll faster this close to the start or the end, so the pill switches on time. */
const NEAR_BOUNDARY_MS = 2 * 60_000;

export type HappyHourWindow = { state: 'upcoming' | 'active'; startsAt: string; endsAt: string; text: string };

/** The server's view, with the start and end applied client-side between polls; undefined = nothing to show. */
export function happyHourWindow(view: HappyHourView | undefined, now: number): HappyHourWindow | undefined {
  if (!view || view.state === 'none') return undefined;
  if (Date.parse(view.endsAt) <= now) return undefined;
  return { ...view, state: Date.parse(view.startsAt) <= now ? 'active' : 'upcoming' };
}

/** SWR refresh interval: 10 s within 2 minutes of the start or the end, else 30 s. */
export function happyHourRefreshInterval(view: HappyHourView | undefined, now = Date.now()): number {
  if (!view || view.state === 'none') return HAPPY_HOUR_POLL_MS;
  const near = [view.startsAt, view.endsAt].some((time) => Math.abs(Date.parse(time) - now) <= NEAR_BOUNDARY_MS);
  return near ? HAPPY_HOUR_POLL_NEAR_MS : HAPPY_HOUR_POLL_MS;
}

/** Pill text in two parts (bold title, lighter countdown): "Happy hour · 2× punten" + "nog 34 min", or "Happy hour om 21:00" + "over 12 min". */
export function happyHourPill(window: HappyHourWindow, now: number): { title: string; countdown: string } {
  if (window.state === 'active') return { title: 'Happy hour · 2× punten', countdown: `nog ${minutesLeft(window.endsAt, now)} min` };
  return { title: `Happy hour om ${formatClock(window.startsAt)}`, countdown: `over ${minutesLeft(window.startsAt, now)} min` };
}

/** "Happy hour · 2× punten · nog 34 min" (e.g. for the pill's accessible label). */
export function happyHourPillText(window: HappyHourWindow, now: number): string {
  const { title, countdown } = happyHourPill(window, now);
  return `${title} · ${countdown}`;
}

/** "Hunts tellen dubbel van 21:00 tot 22:00. Tegenhunts tellen niet mee." */
export function happyHourExplanation(window: Pick<HappyHourWindow, 'startsAt' | 'endsAt'>): string {
  return `Hunts tellen dubbel van ${formatClock(window.startsAt)} tot ${formatClock(window.endsAt)}. Tegenhunts tellen niet mee.`;
}
