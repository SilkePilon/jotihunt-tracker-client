import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { mutate as mutateGlobal } from 'swr';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import { swrKeyFor, telegramAdminRefreshInterval, TELEGRAM_MESSAGES_POLL_MS, TELEGRAM_MESSAGES_URL, TELEGRAM_VIEW_PATHS, HAPPY_HOUR_VIEW_PATHS } from '@/lib/telegram';
import type { TelegramAdminStatus, TelegramMessages } from '@/types/Telegram';

/** Refetch the tegenhunt view and the bot messages (after a tegenhunt notification or a link change). */
export function revalidateTelegramViews() {
  void mutateGlobal(swrKeyFor(TELEGRAM_VIEW_PATHS));
}

/** Refetch the happy hour (and the bot messages) after a happy-hour notification. */
export function revalidateHappyHour() {
  void mutateGlobal(swrKeyFor(HAPPY_HOUR_VIEW_PATHS));
}

/** The @Jotihunt_bot messages (newest first) and whether the group's Telegram account is linked. */
export function useTelegramMessages() {
  const { data, error } = useAuthSWR<TelegramMessages>(TELEGRAM_MESSAGES_URL, { refreshInterval: TELEGRAM_MESSAGES_POLL_MS });
  return { messages: data?.messages, linked: data?.linked, isError: !!error };
}

/** Admins: the Telegram link status (polled every 2 s while linking) and the link / password / unlink actions. */
export function useTelegramAdmin(enabled: boolean) {
  const authHeader = useAuthHeader() || '';
  const { data, error, mutate } = useAuthSWR<TelegramAdminStatus>(enabled ? '/admin/telegram' : null, { refreshInterval: telegramAdminRefreshInterval });

  async function post(url: string, body?: unknown): Promise<TelegramAdminStatus> {
    const status = (await fetcherWithMethod(url, authHeader, 'POST', body)) as TelegramAdminStatus;
    await mutate(status, { revalidate: false });
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
      await fetcherWithMethod('/admin/telegram/link', authHeader, 'DELETE');
    } finally {
      await mutate();
      revalidateTelegramViews();
    }
  }

  return { status: data, isError: !!error, link, submitPassword, unlink };
}
