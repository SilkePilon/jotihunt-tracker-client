import type { Life360AdminStatus, Life360LinkedStatus, Life360Location, Life360Members } from '@/types/Life360';
import { formatCountdown, secondsLeft } from '@/lib/app-pairing';

export const LIFE360_ADMIN_URL = '/admin/life360';
export const LIFE360_MEMBERS_URL = '/life360/members';
/** While an admin links the account: the code and circle steps must follow the server quickly. */
export const LIFE360_LINKING_POLL_MS = 2000;
/** Linked, logged out or paused: notice a 401, a pause or the resume. */
export const LIFE360_STATUS_POLL_MS = 30_000;
/** Members while linked (the server polls Life360 every 30 s). */
export const LIFE360_MEMBERS_POLL_MS = 15_000;
/** Members while not linked: only notice that someone linked the account. */
export const LIFE360_MEMBERS_IDLE_POLL_MS = 60_000;
/** A position older than this is grey and not live (the server's liveCount uses the same 15 min). */
export const LIFE360_STALE_MS = 15 * 60_000;
/** Life360's brand colour (buttons, marker rim). */
export const LIFE360_PURPLE = '#7875ea';

/**
 * SWR refresh interval of the admin status: 2 s while linking (code / circle), 30 s once linked (also logged out or
 * paused), else no polling. Pass it as a number (see telegramAdminRefreshInterval: SWR never re-reads a function form
 * that returned 0).
 */
export function life360AdminRefreshInterval(status: Life360AdminStatus | undefined): number {
  switch (status?.state) {
    case 'code':
    case 'circle':
      return LIFE360_LINKING_POLL_MS;
    case 'linked':
    case 'loggedOut':
    case 'paused':
      return LIFE360_STATUS_POLL_MS;
    default:
      return 0;
  }
}

/** SWR refresh interval of GET /life360/members (never 0, so SWR's function form is fine). */
export function life360MembersRefreshInterval(data: Life360Members | undefined): number {
  return data?.linked ? LIFE360_MEMBERS_POLL_MS : LIFE360_MEMBERS_IDLE_POLL_MS;
}

/** What the Life360 card shows: the server state, plus `email` once the admin opened that step, loading and error. */
export type Life360View = 'loading' | 'error' | 'email' | Life360AdminStatus['state'];

export function life360View(status: Life360AdminStatus | undefined, isError: boolean, emailStep: boolean): Life360View {
  if (!status) return isError ? 'error' : 'loading';
  if (status.state === 'unlinked') return emailStep ? 'email' : 'unlinked';
  return status.state;
}

export interface Life360HeaderSummary {
  text: string;
  /** ok = muted text + green cookie, warn = amber text + amber cookie */
  tone?: 'ok' | 'warn';
}

/** Collapsed-section summary. */
export function life360HeaderSummary(status: Life360AdminStatus | undefined): Life360HeaderSummary | undefined {
  if (!status) return undefined;
  switch (status.state) {
    case 'unavailable':
      return { text: 'Niet ingesteld' };
    case 'unlinked':
      return { text: 'Niet gekoppeld' };
    case 'code':
    case 'circle':
      return { text: 'Koppelen…' };
    case 'linked':
      return { text: `${status.liveCount}/${status.memberCount} live`, tone: 'ok' };
    case 'loggedOut':
      return { text: 'Opnieuw koppelen', tone: 'warn' };
    case 'paused':
      return { text: 'Gepauzeerd', tone: 'warn' };
  }
}

/** "12 s geleden", "3 min geleden", "2 uur geleden"; undefined when missing or invalid. A future time counts as 0 s. */
export function formatAgo(iso: string | null | undefined, now: number): string | undefined {
  if (!iso) return undefined;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return undefined;
  const seconds = Math.max(0, Math.floor((now - time) / 1000));
  if (seconds < 60) return `${seconds} s geleden`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min geleden`;
  return `${Math.floor(minutes / 60)} uur geleden`;
}

/** Short age for the member list: "nu", "2 min", "3 uur"; "–" when invalid. */
export function formatAgeShort(iso: string, now: number): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '–';
  const minutes = Math.floor((now - time) / 60_000);
  if (minutes < 1) return 'nu';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} uur`;
}

/** Grey on the map and not live: no fix, a fix older than 15 min, or the whole link is stale (logged out / paused). */
export function isLocationStale(location: Pick<Life360Location, 'at'> | null, linkStale: boolean, now: number): boolean {
  if (!location || linkStale) return true;
  const time = Date.parse(location.at);
  return Number.isNaN(time) || now - time > LIFE360_STALE_MS;
}

/** "5 van 6 live · 12 s geleden" (without the age before the first poll). */
export function life360LiveLine(status: Life360LinkedStatus, now: number): string {
  const live = `${status.liveCount} van ${status.memberCount} live`;
  const ago = formatAgo(status.lastPollAt, now);
  return ago ? `${live} · ${ago}` : live;
}

/** "Jotihunt 2026 · 6 leden" (the members pill). */
export function membersPillText(circleName: string, memberCount: number): string {
  return `${circleName} · ${memberCount} ${memberCount === 1 ? 'lid' : 'leden'}`;
}

/** "0:42" while a new code can't be sent yet, null once it can (also for an unreadable time). */
export function resendCountdown(resendAt: string, now: number): string | null {
  const seconds = secondsLeft(resendAt, now);
  return seconds > 0 ? formatCountdown(seconds) : null;
}

/** A complete login code: exactly 6 digits. */
export function isSixDigits(code: string): boolean {
  return /^\d{6}$/.test(code);
}
