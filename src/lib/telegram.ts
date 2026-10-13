import type { TelegramAdminStatus } from '@/types/Telegram';

export const TELEGRAM_MESSAGES_URL = '/telegram/messages?limit=50';
export const TELEGRAM_MESSAGES_POLL_MS = 30_000;
/** While an admin links the account: the QR token rotates (~30 s) and the scan must show up quickly. */
export const TELEGRAM_LINKING_POLL_MS = 2000;

/** SWR refresh interval of the admin status: every 2 s while linking (QR or 2FA password), else no polling. */
export function telegramAdminRefreshInterval(status: TelegramAdminStatus | undefined): number {
  return status?.state === 'qr' || status?.state === 'password' ? TELEGRAM_LINKING_POLL_MS : 0;
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
