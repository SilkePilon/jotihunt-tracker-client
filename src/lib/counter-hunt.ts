import { formatClock } from '@/lib/format';
import type { CounterHuntView } from '@/types/Telegram';

/** The wind directions a tegenhunt can come from (degrees), with Dutch labels. Keep in sync with the server's notifier.helpers. */
export const COUNTER_HUNT_DIRECTIONS = [
  { degrees: 0, short: 'N', name: 'Noord', from: 'het noorden', arrow: '↑' },
  { degrees: 45, short: 'NO', name: 'Noordoost', from: 'het noordoosten', arrow: '↗' },
  { degrees: 90, short: 'O', name: 'Oost', from: 'het oosten', arrow: '→' },
  { degrees: 135, short: 'ZO', name: 'Zuidoost', from: 'het zuidoosten', arrow: '↘' },
  { degrees: 180, short: 'Z', name: 'Zuid', from: 'het zuiden', arrow: '↓' },
  { degrees: 225, short: 'ZW', name: 'Zuidwest', from: 'het zuidwesten', arrow: '↙' },
  { degrees: 270, short: 'W', name: 'West', from: 'het westen', arrow: '←' },
  { degrees: 315, short: 'NW', name: 'Noordwest', from: 'het noordwesten', arrow: '↖' },
] as const;

export type CounterHuntDirection = (typeof COUNTER_HUNT_DIRECTIONS)[number];

export const COUNTER_HUNT_POLL_ACTIVE_MS = 10_000;
export const COUNTER_HUNT_POLL_QUIET_MS = 30_000;

/** The direction entry for `degrees` (one of the 8), undefined for null or an unknown value. */
export function counterHuntDirection(degrees: number | null | undefined): CounterHuntDirection | undefined {
  return COUNTER_HUNT_DIRECTIONS.find((item) => item.degrees === degrees);
}

/** Whole minutes until `endsAt` (rounded up), never negative. */
export function minutesLeft(endsAt: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 60_000));
}

/** The card's state: the server's view, but a tegenhunt whose 30 minutes ran out between polls counts as ended. */
export type CounterHuntState =
  | { kind: 'active'; direction: number | null; startedAt: string; endsAt: string; text?: string }
  | { kind: 'quiet'; last?: { direction: number | null; startedAt: string } };

export function counterHuntState(view: CounterHuntView | undefined, now: number): CounterHuntState | undefined {
  if (!view) return undefined;
  if (!view.active) return { kind: 'quiet', last: view.last };
  if (Date.parse(view.endsAt) <= now) return { kind: 'quiet', last: { direction: view.direction, startedAt: view.startedAt } };
  return { kind: 'active', direction: view.direction, startedAt: view.startedAt, endsAt: view.endsAt, text: view.text };
}

/** SWR refresh interval: 10 s while a tegenhunt runs, else 30 s. */
export function counterHuntRefreshInterval(view: CounterHuntView | undefined): number {
  return view?.active ? COUNTER_HUNT_POLL_ACTIVE_MS : COUNTER_HUNT_POLL_QUIET_MS;
}

/** "Tegenhunt uit het noordoosten", or "Tegenhunt!" when the direction wasn't recognised. */
export function counterHuntTitle(direction: number | null): string {
  const item = counterHuntDirection(direction);
  return item ? `Tegenhunt uit ${item.from}` : 'Tegenhunt!';
}

/** "Laatste: 21:14 uit het noordoosten" (or without the direction when it wasn't recognised). */
export function counterHuntLastText(last: { direction: number | null; startedAt: string }): string {
  const item = counterHuntDirection(last.direction);
  return `Laatste: ${formatClock(last.startedAt)}${item ? ` uit ${item.from}` : ''}`;
}

/** Collapsed-section summary and its colour. `linked` is false only when the server says Telegram isn't linked. */
export function counterHuntSummary(state: CounterHuntState | undefined, linked: boolean | undefined, now: number): { text: string; tone?: 'danger' | 'warn' } | undefined {
  if (!state) return undefined;
  if (state.kind === 'active') {
    const left = `nog ${minutesLeft(state.endsAt, now)} min`;
    const item = counterHuntDirection(state.direction);
    // U+FE0E: text presentation, some fonts draw ↗ ↘ ↙ ↖ as emoji
    return { text: item ? `${item.short} ${item.arrow}\uFE0E · ${left}` : left, tone: 'danger' };
  }
  if (linked === false) return { text: 'Niet gekoppeld', tone: 'warn' };
  return { text: 'Geen' };
}

