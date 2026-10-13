import type { TelegramAdminStatus, TelegramMessages } from '@/types/Telegram';

/** Can tegenhunts come in: linked and connected, linked but disconnected (reconnecting), or not linked at all. */
export type TelegramLink = 'connected' | 'disconnected' | 'unlinked';

/** From GET /telegram/messages; undefined while loading. */
export function telegramLink(data: Pick<TelegramMessages, 'linked' | 'connected'> | undefined): TelegramLink | undefined {
  if (!data) return undefined;
  if (!data.linked) return 'unlinked';
  return data.connected === false ? 'disconnected' : 'connected';
}

export const TELEGRAM_MESSAGES_URL = '/telegram/messages?limit=50';
export const TELEGRAM_MESSAGES_POLL_MS = 30_000;
/** While an admin links the account: the QR token rotates (~30 s) and the scan must show up quickly. */
export const TELEGRAM_LINKING_POLL_MS = 2000;

/** While linked: notice a session revoked on the server ("Luistert via …" must not stay). */
export const TELEGRAM_LINKED_POLL_MS = 30_000;

/**
 * SWR refresh interval of the admin status: every 2 s while linking (QR or 2FA password), 30 s while linked, else no
 * polling. Pass the result as a number, not as SWR's function form: SWR only re-reads that function after a timer
 * fired, so a 0 (no timer) would never turn into polling.
 */
export function telegramAdminRefreshInterval(status: TelegramAdminStatus | undefined): number {
  if (status?.state === 'qr' || status?.state === 'password') return TELEGRAM_LINKING_POLL_MS;
  return status?.state === 'linked' ? TELEGRAM_LINKED_POLL_MS : 0;
}

/**
 * SWR key filter for `mutate(filter)`: matches the `[url, authHeader]` keys of `useAuthSWR` whose path (without the
 * query string) is one of `paths`.
 */
export function swrKeyFor(paths: readonly string[]) {
  return (key: unknown): boolean => Array.isArray(key) && typeof key[0] === 'string' && paths.includes(key[0].split('?')[0]);
}

/** What changes when a tegenhunt comes in or the Telegram link changes. */
export const TELEGRAM_VIEW_PATHS = ['/counter-hunt', '/telegram/messages'] as const;
/** What changes when a happy hour is announced, starts or ends. */
export const HAPPY_HOUR_VIEW_PATHS = ['/happy-hour', '/telegram/messages'] as const;
