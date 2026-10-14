import { useCallback } from 'react';
import { mutate as mutateGlobal } from 'swr';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { useAuthSWR } from '@/lib/swr';
import type { Vehicle } from '@/types/Tracker';
import { User } from '@/types/User';
import { useFetcher } from './utils/api.hook';
import { asList } from '@/lib/response-shape';
import { swrKeyFor } from '@/lib/telegram';

/** Changes an admin can make to a user; only the given fields are sent, so a stale row can't undo another change */
export interface UserChanges {
  name?: string;
  admin?: boolean;
}

export const useAdmin = () => {
  const { data, error, mutate } = useAuthSWR<User[]>('/admin/users');
  const { fetch } = useFetcher();
  const authHeader = useAuthHeader();

  /**
   * Run a request; resolves to null on success, else to the error (axios throws on 4xx/5xx, so the server's message
   * can be shown with apiErrorMessage).
   */
  async function failure(request: () => Promise<{ status: number }>, expected: number): Promise<unknown> {
    try {
      const { status } = await request();
      return status === expected ? null : new Error(`Unexpected status ${status}`);
    } catch (error) {
      return error ?? new Error('Request failed');
    } finally {
      void mutate();
    }
  }

  /** Sends only `changes`; resolves to null on success, else to the error */
  function updateUser(id: string, changes: UserChanges): Promise<unknown> {
    return failure(() => fetch(`/admin/users/${id}`, 'PUT', changes), 200);
  }

  /** Resolves to null on success, else to the error */
  function deleteUser(id: string): Promise<unknown> {
    return failure(() => fetch(`/admin/users/${id}`, 'DELETE'), 200);
  }

  /**
   * One-time herstel-link (1 hour) for a user who lost their passkey. Throws the axios error on failure.
   * Stable while the session token stays the same, so a dialog can make the link in an effect.
   */
  const createRecoveryLink = useCallback(
    async (id: string): Promise<{ url: string; expiresAt: string }> => {
      const { data } = await fetch<{ url: string; expiresAt: string }>(`/admin/users/${id}/recovery-link`, 'POST');
      return data;
    },
    // fetch is a new function every render; it only changes meaningfully with the auth header
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [authHeader],
  );

  /** Move any hunter's Traccar device to a vehicle group (map icon). Throws the axios error on failure. */
  async function setDeviceVehicle(deviceId: number, vehicle: Vehicle): Promise<void> {
    await fetch(`/admin/devices/${deviceId}/vehicle`, 'PUT', { vehicle });
    void mutate();
    // The vehicle comes from the device's group: refetch now instead of on the next 3 s poll
    void mutateGlobal(swrKeyFor(['/tracker/devices']));
  }

  return {
    users: asList(data),
    isLoading: !error && !data,
    isError: error,
    updateUser,
    deleteUser,
    createRecoveryLink,
    setDeviceVehicle,
  };
};
