import { formatClock } from './format';
import type { Brand, FastfoodRestaurant } from '@/types/Fastfood';

export type { Brand } from '@/types/Fastfood';

export const BRANDS: Brand[] = ['mcdonalds', 'kfc', 'burgerking'];
export const BRAND_LABEL: Record<Brand, string> = { mcdonalds: "McDonald's", kfc: 'KFC', burgerking: 'Burger King' };
/** Marker tile and popup icon fill */
export const BRAND_COLOR: Record<Brand, string> = { mcdonalds: '#DB0007', kfc: '#E4002B', burgerking: '#F5EBDC' };
/** Tooltip dot (Burger King's cream tile colour is invisible as a dot) */
export const BRAND_DOT: Record<Brand, string> = { mcdonalds: '#DB0007', kfc: '#E4002B', burgerking: '#D62300' };

export type FastfoodState = 'open' | 'closing' | 'closed' | 'unknown';

export interface FastfoodStatus {
  state: FastfoodState;
  /** Bold status row text, e.g. "Open tot 01:30" */
  title: string;
  /** Second line, e.g. "nog 1 u 50 min" */
  meta: string;
  /** Tooltip text, absent when unknown */
  short?: string;
}

/** Open but closing within this: orange */
export const CLOSING_SOON_MS = 30 * 60_000;
/** An open interval ending further away than this is the window's end (24/7) */
const ALWAYS_OPEN_MS = 6 * 24 * 60 * 60_000;
const ZONE = 'Europe/Amsterdam';
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const weekday = new Intl.DateTimeFormat('nl-NL', { timeZone: ZONE, weekday: 'long' });

function formatLeft(ms: number): string {
  const minutes = Math.max(1, Math.floor(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} u ${rest} min` : `${hours} u`;
}

/** "vandaag", "morgen" or the weekday of `ms`, seen from `nowMs` (Dutch calendar days). */
function dayLabel(ms: number, nowMs: number): string {
  const days = Math.round((Date.parse(dayKey.format(ms)) - Date.parse(dayKey.format(nowMs))) / 86_400_000);
  if (days <= 0) return 'vandaag';
  if (days === 1) return 'morgen';
  return weekday.format(ms);
}

/** Open / closing soon / closed (and when it opens) / unknown, from the server's open intervals. */
export function fastfoodStatus(intervals: FastfoodRestaurant['intervals'], nowMs: number): FastfoodStatus {
  if (!intervals) return { state: 'unknown', title: 'Openingstijden onbekend', meta: 'niet bekend in OpenStreetMap' };
  const parsed = intervals.map(({ start, end }) => ({ start: Date.parse(start), end: Date.parse(end) }));
  const current = parsed.find(({ start, end }) => start <= nowMs && nowMs < end);
  if (current) {
    const left = current.end - nowMs;
    if (left > ALWAYS_OPEN_MS) return { state: 'open', title: 'Dag en nacht open', meta: 'de hele week', short: 'dag en nacht open' };
    const clock = formatClock(current.end);
    if (left <= CLOSING_SOON_MS) return { state: 'closing', title: `Sluit om ${clock}`, meta: `nog ${formatLeft(left)}`, short: `sluit om ${clock}` };
    return { state: 'open', title: `Open tot ${clock}`, meta: `nog ${formatLeft(left)}`, short: `open tot ${clock}` };
  }
  const next = parsed.filter(({ start }) => start > nowMs).sort((a, b) => a.start - b.start)[0];
  if (!next) return { state: 'closed', title: 'Dicht', meta: 'opent niet in de komende week', short: 'dicht' };
  return { state: 'closed', title: 'Dicht', meta: `opent ${dayLabel(next.start, nowMs)} ${formatClock(next.start)}`, short: 'dicht' };
}

/** The brands whose layer is on, in menu order. */
export function shownBrands(flags: { showMcDonalds: boolean; showKfc: boolean; showBurgerKing: boolean }): Brand[] {
  return BRANDS.filter((brand) => (brand === 'mcdonalds' ? flags.showMcDonalds : brand === 'kfc' ? flags.showKfc : flags.showBurgerKing));
}

/** "Rijnstraat 36" and "6811 EW Arnhem" (a Dutch postcode gets its space). */
export function restaurantAddress(restaurant: FastfoodRestaurant): { line1?: string; line2?: string } {
  const line1 = [restaurant.street, restaurant.houseNumber].filter(Boolean).join(' ') || undefined;
  const postcode = restaurant.postcode?.replace(/^(\d{4})\s*([A-Za-z]{2})$/, '$1 $2');
  const line2 = [postcode, restaurant.city].filter(Boolean).join(' ') || undefined;
  return { line1, line2 };
}
