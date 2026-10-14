import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import { asList } from '@/lib/response-shape';
import type { AdminInvite, InviteExpiry } from '@/lib/beheer';

const REFRESH_MS = 30_000;

/** Beheer → Invites: the invite links (active, and stopped ones for 24 h). Pass `enabled` false to skip fetching. */
export const useInvites = (enabled: boolean) => {
  const authHeader = useAuthHeader() || '';
  const { data, error, mutate } = useAuthSWR<AdminInvite[]>(enabled ? '/admin/invites' : null, { refreshInterval: REFRESH_MS });

  /** New invite link; `maxUses: null` (unlimited) is sent explicitly. Throws the axios error on failure. */
  async function create(expiry: InviteExpiry, maxUses: number | null): Promise<AdminInvite> {
    try {
      return (await fetcherWithMethod('/admin/invites', authHeader, 'POST', { expiry, maxUses })) as AdminInvite;
    } finally {
      void mutate();
    }
  }

  /** Throws the axios error on failure. */
  async function revoke(id: string): Promise<void> {
    try {
      await fetcherWithMethod(`/admin/invites/${id}`, authHeader, 'DELETE');
    } finally {
      void mutate();
    }
  }

  return { invites: asList(data), error, create, revoke };
};

/** Global admin switch that stops new accounts via invite links. `paused` is undefined until loaded. */
export const useInvitesPaused = () => {
  const authHeader = useAuthHeader() || '';
  const { data, mutate } = useAuthSWR<{ paused: boolean }>('/settings/invites-paused', { refreshInterval: REFRESH_MS });

  /** Admin only; throws the axios error on failure. */
  async function setPaused(paused: boolean): Promise<void> {
    const result = (await fetcherWithMethod('/settings/invites-paused', authHeader, 'PUT', { paused })) as { paused: boolean };
    await mutate(result, { revalidate: false });
  }

  return { paused: data?.paused, setPaused };
};
