import { joinParts } from '@/lib/format';
import type { TrackerMe, TrackerNotConfiguredReason, Vehicle } from '@/types/Tracker';

export const TRACKER_POLL_NOT_CONNECTED_MS = 10_000;
export const TRACKER_POLL_CONNECTED_MS = 30_000;
/** Nothing changes quickly while live tracking isn't set up; don't poll as often. */
export const TRACKER_POLL_NOT_CONFIGURED_MS = 60_000;

/** `phrase` is the "Mijn tracker" pill text. */
export const VEHICLE_OPTIONS: { value: Vehicle; label: string; phrase: string }[] = [
  { value: 'walking', label: 'Lopend', phrase: 'Lopend' },
  { value: 'bike', label: 'Fiets', phrase: 'Op de fiets' },
  { value: 'car', label: 'Auto', phrase: 'In de auto' },
  { value: 'motorcycle', label: 'Motor', phrase: 'Op de motor' },
];

/** A tracker counts as active when it reported in the last 5 minutes. */
export const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

/** Whether a fix / last update time is at most {@link ACTIVE_WINDOW_MS} ago; false when missing or invalid. */
export function isActive(fixTime: Date | string | number | null | undefined, now = Date.now()): boolean {
  if (fixTime == null) return false;
  const time = new Date(fixTime).getTime();
  return Number.isFinite(time) && now - time <= ACTIVE_WINDOW_MS;
}

export const TRACCAR_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=org.traccar.client';
export const TRACCAR_APP_STORE_URL = 'https://apps.apple.com/app/id843156974';

export function isVehicle(value: string): value is Vehicle {
  return VEHICLE_OPTIONS.some((option) => option.value === value);
}

/** SWR refresh interval: 10 s until connected, then 30 s. */
export function trackerRefreshInterval(status: TrackerMe | undefined): number {
  if (!status) return TRACKER_POLL_NOT_CONNECTED_MS;
  if (!status.configured) return TRACKER_POLL_NOT_CONFIGURED_MS;
  return status.connected ? TRACKER_POLL_CONNECTED_MS : TRACKER_POLL_NOT_CONNECTED_MS;
}

/** Paired before (Traccar has an update) but nothing in the last 5 minutes: the app stopped or lost signal. */
function hasSignalLost(status: TrackerMe | undefined): boolean {
  return !!status?.configured && !status.connected && !!status.stats.lastUpdate;
}

/** Collapsed-section summary. */
export function trackerSummary(status: TrackerMe | undefined): string | undefined {
  if (!status) return undefined;
  if (!status.configured) return status.reason === 'unreachable' ? 'Niet bereikbaar' : 'Niet ingesteld';
  if (hasSignalLost(status)) return 'Geen signaal';
  return status.connected ? 'Verbonden' : 'Niet verbonden';
}

export type TrackerView = 'loading' | 'error' | 'not-configured' | 'idle' | 'pairing' | 'connected' | 'no-signal';

/** Which "Mijn tracker" view to show; `pairing` = the user opened the pairing panel. */
export function trackerView(status: TrackerMe | undefined, isError: boolean, pairing: boolean): TrackerView {
  if (!status) return isError ? 'error' : 'loading';
  if (!status.configured) return 'not-configured';
  if (pairing) return 'pairing';
  if (status.connected) return 'connected';
  return hasSignalLost(status) ? 'no-signal' : 'idle';
}

/** Text for the "not configured" state; admins also get the fix. */
export function notConfiguredText(reason: TrackerNotConfiguredReason, admin: boolean): { title: string; hint?: string } {
  if (reason === 'unreachable') {
    return { title: 'De trackerserver is nu niet bereikbaar.', hint: admin ? 'Controleer of Traccar draait en of de Traccar-token nog geldig is.' : undefined };
  }
  if (reason === 'group_invalid') {
    return {
      title: admin ? 'Traccar-groep bestaat niet — controleer GROUP_*_ID in .env' : 'Live tracking is tijdelijk niet beschikbaar',
    };
  }
  const hint =
    reason === 'client_url_invalid'
      ? 'TRACCAR_CLIENT_URL in .env is geen geldige http(s)-URL.'
      : 'Vul TRACCAR_CLIENT_URL en de Traccar-token in .env in.';
  return { title: 'Live tracking is nog niet ingesteld.', hint: admin ? hint : undefined };
}

/**
 * How the "Mijn tracker" section should react when `connected` changes (undefined = unknown / not configured):
 * open when we learn the phone is not connected. Connecting leaves it open, so the user sees the green badge.
 */
export function sectionTransition(previous: boolean | undefined, next: boolean | undefined): 'open' | null {
  return next === false && previous !== false ? 'open' : null;
}

const decimal = (value: number, digits: number) =>
  value.toLocaleString('nl-NL', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function formatSpeed(kmh: number | undefined): string {
  return kmh === undefined ? '–' : `${decimal(kmh, kmh < 10 ? 1 : 0)} km/u`;
}

export function formatBattery(percent: number | undefined): string {
  return percent === undefined ? '–' : `${Math.round(percent)}%`;
}

export function formatAccuracy(metres: number | undefined): string {
  return metres === undefined ? '–' : `± ${Math.round(metres)} m`;
}

export function formatDistance(metres: number | undefined): string {
  if (metres === undefined) return '–';
  return metres < 1000 ? `${Math.round(metres)} m` : `${decimal(metres / 1000, 1)} km`;
}

/** "zojuist", "3 min geleden", "2 uur geleden" or "–". */
export function formatLastUpdate(iso: string | undefined, now: number): string {
  if (!iso) return '–';
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (Number.isNaN(minutes)) return '–';
  if (minutes < 1) return 'zojuist';
  if (minutes < 60) return `${minutes} min geleden`;
  return `${Math.floor(minutes / 60)} uur geleden`;
}

function ageText(iso: string | undefined, now: number): string | undefined {
  if (!iso) return undefined;
  const time = Date.parse(iso);
  // A malformed timestamp would read "NaN u"; leave the age out instead
  if (Number.isNaN(time)) return undefined;
  const seconds = Math.max(0, Math.round((now - time) / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} u`;
}

/** First line of the phone sheet's peek strip. */
export function trackerPeekLine(status: TrackerMe | undefined, now = Date.now()): { tone: 'ok' | 'warn' | 'muted'; text: string } {
  if (!status) return { tone: 'muted', text: 'Tracker laden…' };
  if (!status.configured) return { tone: 'muted', text: status.reason === 'unreachable' ? 'Tracker niet bereikbaar' : 'Tracker niet ingesteld' };
  const age = ageText(status.stats.lastUpdate, now);
  if (status.connected) {
    const vehicle = VEHICLE_OPTIONS.find((option) => option.value === status.vehicle)?.phrase.toLowerCase();
    return { tone: 'ok', text: joinParts('Verbonden', vehicle, age) };
  }
  if (hasSignalLost(status)) return { tone: 'warn', text: joinParts('Geen signaal', age) };
  return { tone: 'warn', text: 'Koppel je telefoon' };
}
