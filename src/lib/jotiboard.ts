import { formatClock } from '@/lib/format';
import { formatAgo } from '@/lib/life360';
import type { JotiboardCounts, JotiboardStatus } from '@/types/Jotiboard';

export const JOTIBOARD_ADMIN_URL = '/admin/jotiboard';
/** Jotiboard's dark slate (their CSS); Jotiboard has no logo of its own */
export const JOTIBOARD_SLATE = '#0f172b';
export const JOTIBOARD_STATUS_POLL_MS = 20_000;
/** Right after linking / turning sync on, until the server's first sync landed (not while it keeps failing) */
export const JOTIBOARD_FAST_POLL_MS = 3000;

/** A plain number for SWR (a function-form refreshInterval is only re-read when its own timer fires). */
export function jotiboardRefreshInterval(status: JotiboardStatus | undefined): number {
  return status?.state === 'linked' && status.syncEnabled && !status.lastSyncAt && !status.lastError ? JOTIBOARD_FAST_POLL_MS : JOTIBOARD_STATUS_POLL_MS;
}

export type JotiboardView = 'loading' | 'error' | 'unavailable' | 'unlinked' | 'syncing' | 'failing' | 'paused' | 'loggedOut';

export function jotiboardView(status: JotiboardStatus | undefined, isError: boolean): JotiboardView {
  if (!status) return isError ? 'error' : 'loading';
  if (status.state !== 'linked') return status.state;
  if (!status.syncEnabled) return 'paused';
  return status.lastError ? 'failing' : 'syncing';
}

const HEADER: Record<Exclude<JotiboardView, 'loading' | 'error'>, string> = {
  unavailable: 'Niet ingesteld',
  unlinked: 'Niet gekoppeld',
  syncing: 'Synchroniseert',
  failing: 'Fout',
  paused: 'Gepauzeerd',
  loggedOut: 'Opnieuw inloggen',
};

/** Collapsed header text (plain muted text, like every section). */
export function jotiboardHeaderSummary(status: JotiboardStatus | undefined): string | undefined {
  const view = jotiboardView(status, false);
  return view === 'loading' || view === 'error' ? undefined : HEADER[view];
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "5 pins · 2 hints" */
export function countsText(counts: JotiboardCounts): string {
  return `${plural(counts.pins, 'pin', 'pins')} · ${plural(counts.hints, 'hint', 'hints')}`;
}

/** "5 pins en 2 hints" (delete row + confirm) */
export function purgeText(counts: JotiboardCounts): string {
  return `${plural(counts.pins, 'pin', 'pins')} en ${plural(counts.hints, 'hint', 'hints')}`;
}

export function hasImports(counts: JotiboardCounts): boolean {
  return counts.pins + counts.hints > 0;
}

/** The muted line under the title of the linked card. */
export function jotiboardSyncLine(status: Extract<JotiboardStatus, { state: 'linked' }>, now: number): string {
  const counts = countsText(status.counts);
  if (!status.syncEnabled) return status.lastSyncAt ? `Laatst ${formatClock(status.lastSyncAt)} · ${counts}` : counts;
  if (!status.lastSyncAt) return `Eerste sync… · ${counts}`;
  const ago = formatAgo(status.lastSyncAt, now);
  return status.lastError ? `Laatst gelukt ${ago} · ${counts}` : `${ago} · ${counts}`;
}
