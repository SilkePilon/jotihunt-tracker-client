import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { mutate as mutateGlobal } from 'swr';
import { SLOW_REQUEST_TIMEOUT_MS } from '@/lib/http';
import { fetcherWithMethod, useAdaptiveSWR, useAuthSWR, useStatusAction } from '@/lib/swr';
import {
  HAPPY_HOUR_VIEW_PATHS,
  telegramLink,
  swrKeyFor,
  telegramAdminRefreshInterval,
  TELEGRAM_MESSAGES_POLL_MS,
  TELEGRAM_MESSAGES_URL,
  TELEGRAM_VIEW_PATHS,
} from '@/lib/telegram';
import type { TelegramAdminStatus, TelegramMessages } from '@/types/Telegram';

/** Refetch the tegenhunt view and the bot messages (after a tegenhunt notification or a link change). */
export function revalidateTelegramViews() {
  void mutateGlobal(swrKeyFor(TELEGRAM_VIEW_PATHS));
}

/** Refetch the happy hour (and the bot messages) after a happy-hour notification. */
export function revalidateHappyHour() {
  void mutateGlobal(swrKeyFor(HAPPY_HOUR_VIEW_PATHS));
}

/** The @Jotihunt_bot messages (newest first), whether the group's Telegram account is linked and connected. */
export function useTelegramMessages() {
  const { data, error } = useAuthSWR<TelegramMessages>(TELEGRAM_MESSAGES_URL, { refreshInterval: TELEGRAM_MESSAGES_POLL_MS });
  return { messages: data?.messages, linked: data?.linked, link: telegramLink(data), isError: !!error };
}

/**
 * Admins: the Telegram link status (polled every 2 s while linking, 30 s while linked) and the link / password /
 * unlink actions. These wait on Telegram (QR login, SRP + connect, log out), so they get the slow timeout.
 */
export function useTelegramAdmin(enabled: boolean) {
  const authHeader = useAuthHeader() || '';
  // The interval follows the latest status (see telegramAdminRefreshInterval)
  const { data, error, mutate } = useAdaptiveSWR<TelegramAdminStatus>(enabled ? '/admin/telegram' : null, telegramAdminRefreshInterval, 0);
  // Failing with e.g. 409 (already linked elsewhere) or 503 refetches the status
  const send = useStatusAction(mutate);

  async function post(url: string, body?: unknown): Promise<TelegramAdminStatus> {
    const status = await send(url, 'POST', body);
    if (status.state === 'linked') revalidateTelegramViews();
    return status;
  }

  /** Start a QR login. Throws on failure. */
  const link = () => post('/admin/telegram/link');
  /** Send the 2FA cloud password. Throws on failure (400 "Wachtwoord klopt niet." on a wrong one). */
  const submitPassword = (password: string) => post('/admin/telegram/password', { password });

  /** Cancel a pending login or log the linked account out. Throws on failure. */
  async function unlink(): Promise<void> {
    try {
      await fetcherWithMethod('/admin/telegram/link', authHeader, 'DELETE', undefined, SLOW_REQUEST_TIMEOUT_MS);
    } finally {
      await mutate();
      revalidateTelegramViews();
    }
  }

  /** Re-read the status now (e.g. the messages say the link is gone). */
  const refresh = () => void mutate();

  return { status: data, isError: !!error, link, submitPassword, unlink, refresh };
}
