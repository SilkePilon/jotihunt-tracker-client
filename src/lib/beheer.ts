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

/** "2 passkeys · nu actief", "Geen passkey · 3 dagen geleden" */
export function userMeta(user: { passkeyCount?: number; lastActiveAt?: string | null }, now: number): string {
  const count = user.passkeyCount ?? 0;
  const passkeys = count === 0 ? 'Geen passkey' : count === 1 ? '1 passkey' : `${count} passkeys`;
  let activity: string;
  if (!user.lastActiveAt) activity = 'nooit actief';
  else if (now - Date.parse(user.lastActiveAt) < ACTIVE_NOW_MS) activity = 'nu actief';
  else activity = formatAgo(user.lastActiveAt, now);
  return `${passkeys} · ${activity}`;
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

/** "7 van 25 gebruikt · nog 6 uur · Silke", "Eenmalig · nog 52 min · Silke", "3 van 3 gebruikt · vol · Silke" */
export function inviteMeta(invite: AdminInvite, now: number): string {
  let uses: string;
  if (invite.maxUses === 1) uses = invite.uses >= 1 ? 'Gebruikt' : 'Eenmalig';
  else if (invite.maxUses !== null) uses = `${invite.uses} van ${invite.maxUses} gebruikt`;
  else uses = `${invite.uses} gebruikt`;

  let time: string;
  if (invite.state !== 'active') time = STOPPED_TEXT[invite.state];
  else if (invite.expiresAt === null) time = 'verloopt nooit';
  else time = formatTimeLeft(invite.expiresAt, now);

  return [uses, time, invite.createdBy?.name].filter(Boolean).join(' · ');
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
