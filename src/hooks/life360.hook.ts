import { useState } from 'react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { mutate as mutateGlobal } from 'swr';
import { SLOW_REQUEST_TIMEOUT_MS } from '@/lib/http';
import { LIFE360_ADMIN_URL, LIFE360_MEMBERS_URL, life360AdminRefreshInterval, life360MembersRefreshInterval } from '@/lib/life360';
import { life360DevFixture } from '@/lib/life360-fixtures';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import { swrKeyFor } from '@/lib/telegram';
import type { Life360AdminStatus, Life360Members } from '@/types/Life360';

/** Refetch the members (after a link change), wherever they are shown. */
export function revalidateLife360Members() {
  void mutateGlobal(swrKeyFor([LIFE360_MEMBERS_URL]));
}

/**
 * The Life360 members for the map layer, the layers menu and the admin card: every 15 s while linked, every 60 s
 * while not. Nothing is fetched while `enabled` is false. Dev builds: a fixture from localStorage replaces the server.
 */
export function useLife360Members(enabled: boolean) {
  const fixture = import.meta.env.DEV ? life360DevFixture() : undefined;
  const { data, error } = useAuthSWR<Life360Members>(enabled && !fixture ? LIFE360_MEMBERS_URL : null, { refreshInterval: life360MembersRefreshInterval });
  return { data: enabled ? (fixture?.members ?? data) : undefined, isError: !!error };
}

/**
 * Admins: the Life360 link status (2 s while linking, 30 s once linked) and the link actions. The actions wait on
 * Life360, so they get the slow timeout; each resolves to the new status or throws the axios error.
 */
export function useLife360Admin(enabled: boolean) {
  const authHeader = useAuthHeader() || '';
  const fixture = import.meta.env.DEV ? life360DevFixture() : undefined;
  // The interval follows the latest status as a plain number (see life360AdminRefreshInterval), adjusted during render
  const [refreshInterval, setRefreshInterval] = useState(0);
  const { data, error, mutate } = useAuthSWR<Life360AdminStatus>(enabled && !fixture ? LIFE360_ADMIN_URL : null, { refreshInterval });
  const nextInterval = life360AdminRefreshInterval(data);
  if (nextInterval !== refreshInterval) setRefreshInterval(nextInterval);

  async function post(path: string, body?: unknown): Promise<Life360AdminStatus> {
    try {
      const status = (await fetcherWithMethod(`${LIFE360_ADMIN_URL}${path}`, authHeader, 'POST', body, SLOW_REQUEST_TIMEOUT_MS)) as Life360AdminStatus;
      await mutate(status, { revalidate: false });
      revalidateLife360Members();
      return status;
    } catch (error) {
      // E.g. 409 (no pending login) or 503: show what the server has now instead of a stale step
      void mutate();
      throw error;
    }
  }

  /** E-mail a login code (also "Stuur nieuwe code"). 404 unknown address, 429 too soon. */
  const sendCode = (email: string) => post('/code', { email });
  /** The 6 digits from the mail. 400 "Code klopt niet of is verlopen". */
  const verifyCode = (code: string) => post('/verify', { code });
  /** Pick the team circle when the account has more than one. */
  const chooseCircle = (circleId: string) => post('/circle', { circleId });
  /** Fallback: a pasted LIFE360_AUTH_TOKEN. 400 "Token werkt niet". */
  const submitToken = (token: string) => post('/token', { token });

  /** Ask Life360 for fresh fixes (max 1 per 60 s); resolves to the next allowed time. */
  async function requestFreshLocations(): Promise<string> {
    const { refreshAvailableAt } = (await fetcherWithMethod(`${LIFE360_ADMIN_URL}/refresh`, authHeader, 'POST', undefined, SLOW_REQUEST_TIMEOUT_MS)) as { refreshAvailableAt: string };
    await mutate((current) => (current?.state === 'linked' ? { ...current, refreshAvailableAt } : current), { revalidate: false });
    return refreshAvailableAt;
  }

  /** Cancel a pending login, or unlink. Throws on failure. */
  async function unlink(): Promise<void> {
    try {
      await fetcherWithMethod(`${LIFE360_ADMIN_URL}/link`, authHeader, 'DELETE', undefined, SLOW_REQUEST_TIMEOUT_MS);
    } finally {
      await mutate();
      revalidateLife360Members();
    }
  }

  return { status: enabled ? (fixture?.status ?? data) : undefined, isError: !!error, sendCode, verifyCode, chooseCircle, submitToken, requestFreshLocations, unlink };
}
