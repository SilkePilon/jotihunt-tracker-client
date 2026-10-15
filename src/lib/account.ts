export interface AccountPasskey {
  /** The credential id (base64url) */
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export type SessionVia = 'passkey' | 'invite' | 'herstel' | 'qr' | 'cli';

export interface AccountSession {
  id: string;
  /** "Firefox op Linux" */
  label: string;
  via: SessionVia;
  createdAt: string;
  lastUsedAt: string;
  /** The browser looking at the dialog */
  current: boolean;
}

export interface AccountDevice {
  id: string;
  name: string;
  createdAt: string;
  lastSeenAt: string | null;
}

export interface AccountOverview {
  passkeys: AccountPasskey[];
  sessions: AccountSession[];
  devices: AccountDevice[];
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "zojuist", "5 min geleden", "3 uur geleden", "gisteren", "5 dagen geleden". */
export function formatAgo(iso: string, now: number): string {
  const elapsed = Math.max(0, now - Date.parse(iso));
  if (elapsed < MIN) return 'zojuist';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MIN)} min geleden`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} uur geleden`;
  if (elapsed < 2 * DAY) return 'gisteren';
  return `${Math.floor(elapsed / DAY)} dagen geleden`;
}

const dayFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' });

/** "3 okt" */
export function formatDay(iso: string): string {
  return dayFormat.format(new Date(iso)).replace(/\.$/, '');
}

export function passkeyMeta(passkey: AccountPasskey, now: number): string {
  return `Gemaakt ${formatDay(passkey.createdAt)} · ${passkey.lastUsedAt ? `laatst gebruikt ${formatAgo(passkey.lastUsedAt, now)}` : 'nog niet gebruikt'}`;
}

const VIA_TEXT: Record<SessionVia, string> = {
  passkey: 'met passkey',
  qr: 'met QR-code',
  invite: 'via invite',
  herstel: 'via herstel-link',
  cli: 'via herstel-link',
};

export function sessionMeta(session: AccountSession, now: number): string {
  const via = VIA_TEXT[session.via] ?? VIA_TEXT.passkey;
  // The dialog marks this browser with a "Dit apparaat" chip instead
  return session.current ? via : `${formatAgo(session.lastUsedAt, now)} · ${via}`;
}

export type SessionDevice = 'phone' | 'tablet' | 'computer';

/** Which icon a session gets, from its "Browser op OS" label. */
export function sessionDevice(label: string): SessionDevice {
  const lower = label.toLowerCase();
  if (lower.includes('ipad')) return 'tablet';
  if (lower.includes('android') || lower.includes('iphone')) return 'phone';
  return 'computer';
}

export function deviceMeta(device: AccountDevice, now: number): string {
  return `Android-app · ${device.lastSeenAt ? formatAgo(device.lastSeenAt, now) : 'nog niet gezien'}`;
}

/** This browser first, then the most recently used. */
export function orderSessions(sessions: AccountSession[]): AccountSession[] {
  return [...sessions].sort((a, b) => Number(b.current) - Number(a.current) || Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt));
}
