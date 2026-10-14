import { formatAgo } from '@/lib/account';
import { formatClock } from '@/lib/format';

/** An invite link as GET /admin/invites returns it. */
export interface AdminInvite {
  _id: string;
  code: string;
  url: string;
  createdBy: { _id: string; name: string } | null;
  createdAt: string;
  expiresAt: string | null;
  maxUses: number | null;
  uses: number;
  revokedAt: string | null;
  state: 'active' | 'expired' | 'revoked' | 'full';
}

/** A sent broadcast as GET /admin/broadcasts returns it (newest first). */
export interface Broadcast {
  id: string;
  body: string;
  data: { from?: string };
  createdAt: string;
}

export type InviteExpiry = '30m' | '1h' | '6h' | '12h' | '1d' | '7d' | 'never';

export const EXPIRY_OPTIONS: { value: InviteExpiry; label: string }[] = [
  { value: '30m', label: '30 minuten' },
  { value: '1h', label: '1 uur' },
  { value: '6h', label: '6 uur' },
  { value: '12h', label: '12 uur' },
  { value: '1d', label: '1 dag' },
  { value: '7d', label: '7 dagen' },
  { value: 'never', label: 'Nooit' },
];

export const MAX_USES_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Onbeperkt' },
  ...[1, 5, 10, 25, 50, 100].map((value) => ({ value, label: `${value} keer` })),
];

export const DEFAULT_EXPIRY: InviteExpiry = '1d';
export const DEFAULT_MAX_USES: number | null = null;

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** Active within this long counts as "nu actief". */
const ACTIVE_NOW_MS = 5 * MIN;

/** Active within the last 5 minutes ("nu actief"). */
export function isActiveNow(user: { lastActiveAt?: string | null }, now: number): boolean {
  return !!user.lastActiveAt && now - Date.parse(user.lastActiveAt) < ACTIVE_NOW_MS;
}

/** "nu actief", "3 dagen geleden", "nooit actief" */
export function userActivity(user: { lastActiveAt?: string | null }, now: number): string {
  if (!user.lastActiveAt) return 'nooit actief';
  return isActiveNow(user, now) ? 'nu actief' : formatAgo(user.lastActiveAt, now);
}

/** "geen passkey" (shown amber), "1 passkey", "2 passkeys" */
export function passkeyText(count: number | undefined): string {
  const n = count ?? 0;
  if (n === 0) return 'geen passkey';
  return n === 1 ? '1 passkey' : `${n} passkeys`;
}

/** Gebruikers header line: "5 accounts · 2 nu actief" ("1 account"). */
export function usersSummary(users: { lastActiveAt?: string | null }[], now: number): string {
  const accounts = users.length === 1 ? '1 account' : `${users.length} accounts`;
  return `${accounts} · ${users.filter((user) => isActiveNow(user, now)).length} nu actief`;
}

/** "nog 52 min", "nog 6 uur" (under two days), "nog 3 dagen"; "verlopen" once past. */
export function formatTimeLeft(iso: string, now: number): string {
  const left = Date.parse(iso) - now;
  if (left <= 0) return 'verlopen';
  if (left < HOUR) return `nog ${Math.max(1, Math.floor(left / MIN))} min`;
  if (left < 2 * DAY) return `nog ${Math.floor(left / HOUR)} uur`;
  return `nog ${Math.floor(left / DAY)} dagen`;
}

const STOPPED_TEXT: Record<Exclude<AdminInvite['state'], 'active'>, string> = {
  expired: 'verlopen',
  revoked: 'ingetrokken',
  full: 'vol',
};

/** "7 van 25 gebruikt", "Eenmalig", "Gebruikt", "3 gebruikt" */
export function inviteUses(invite: AdminInvite): string {
  if (invite.maxUses === 1) return invite.uses >= 1 ? 'Gebruikt' : 'Eenmalig';
  if (invite.maxUses !== null) return `${invite.uses} van ${invite.maxUses} gebruikt`;
  return `${invite.uses} gebruikt`;
}

/** "verlopen", "ingetrokken", "vol" */
export function inviteStateText(state: Exclude<AdminInvite['state'], 'active'>): string {
  return STOPPED_TEXT[state];
}

/** "7 van 25 gebruikt · nog 6 uur · Silke", "Eenmalig · nog 52 min · Silke", "3 van 3 gebruikt · vol · Silke" */
export function inviteMeta(invite: AdminInvite, now: number): string {
  let time: string;
  if (invite.state !== 'active') time = STOPPED_TEXT[invite.state];
  else if (invite.expiresAt === null) time = 'verloopt nooit';
  else time = formatTimeLeft(invite.expiresAt, now);

  return [inviteUses(invite), time, invite.createdBy?.name].filter(Boolean).join(' · ');
}

/** Gestopt row: "3 van 3 gebruikt · Silke" (the state shows as a pill). */
export function stoppedInviteMeta(invite: AdminInvite): string {
  return [inviteUses(invite), invite.createdBy?.name].filter(Boolean).join(' · ');
}

/** wa.me share link: WhatsApp opens with `text` ready to send to a chat of choice. */
export function whatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** The WhatsApp message for an invite link. */
export function inviteShareText(url: string): string {
  return `Maak met deze link een account voor onze Jotihunt-app: ${url}`;
}

/** "Silke · 11:42" (HQ when the sender is unknown) */
export function broadcastMeta(broadcast: Broadcast): string {
  return `${broadcast.data.from ?? 'HQ'} · ${formatClock(broadcast.createdAt)}`;
}

/** Admins and members, each sorted by name. */
export function splitUsers<T extends { admin: boolean; name: string }>(users: T[]): { admins: T[]; members: T[] } {
  const sorted = [...users].sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  return { admins: sorted.filter((user) => user.admin), members: sorted.filter((user) => !user.admin) };
}

/** Beheer → Bericht's send button: the first tap asks "Zeker?" (it reaches everyone with sound), the second sends. */
export type SendState = 'idle' | 'confirm' | 'sending' | 'sent';
export type SendEvent = 'tap' | 'expire' | 'success' | 'failure' | 'reset';

/** How long "Zeker? Tik nogmaals" waits for the second tap */
export const SEND_CONFIRM_MS = 3000;
/** How long "Verstuurd ✓" stays */
export const SEND_DONE_MS = 1600;

export function sendTransition(state: SendState, event: SendEvent): SendState {
  switch (state) {
    case 'idle':
      return event === 'tap' ? 'confirm' : state;
    case 'confirm':
      if (event === 'tap') return 'sending';
      return event === 'expire' ? 'idle' : state;
    case 'sending':
      if (event === 'success') return 'sent';
      return event === 'failure' ? 'idle' : state;
    case 'sent':
      if (event === 'reset') return 'idle';
      return event === 'tap' ? 'confirm' : state;
  }
}

/** "Naar 12 mensen sturen" (or "Naar iedereen sturen" while the count is unknown), "Zeker? Tik nogmaals", "Versturen…", "Verstuurd" */
export function sendButtonLabel(state: SendState, recipients: number | undefined): string {
  switch (state) {
    case 'idle':
      if (!recipients) return 'Naar iedereen sturen';
      return recipients === 1 ? 'Naar 1 persoon sturen' : `Naar ${recipients} mensen sturen`;
    case 'confirm':
      return 'Zeker? Tik nogmaals';
    case 'sending':
      return 'Versturen…';
    case 'sent':
      return 'Verstuurd';
  }
}

/**
 * Beheer → Algemeen "Andere vossen die we mogen hunten": a chip for every area but our own (allowed, or locked), and
 * the n/9 count with our own area included when known. `allowed` null/undefined (not configured / loading) = all allowed.
 */
export function huntableChips(
  areas: readonly string[],
  ownArea: string | undefined,
  allowed: string[] | null | undefined,
): { chips: { area: string; allowed: boolean }[]; count: number } {
  const own = ownArea?.toLowerCase();
  const chips = areas.filter((area) => area !== own).map((area) => ({ area, allowed: allowed == null || allowed.includes(area) }));
  const ownCounted = own !== undefined && areas.includes(own) ? 1 : 0;
  return { chips, count: chips.filter((chip) => chip.allowed).length + ownCounted };
}

/** The list to store after tapping `area`: the allowed chips (own area left out) with `area` flipped, sorted. */
export function toggleHuntable(areas: readonly string[], ownArea: string | undefined, allowed: string[] | null | undefined, area: string): string[] {
  const current = huntableChips(areas, ownArea, allowed)
    .chips.filter((chip) => chip.allowed)
    .map((chip) => chip.area);
  const next = current.includes(area) ? current.filter((other) => other !== area) : [...current, area];
  return next.sort();
}
