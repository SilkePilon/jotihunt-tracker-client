import { useAuthSWR } from '@/lib/swr';
import type { Vehicle } from '@/types/Tracker';
import { User } from '@/types/User';
import { useFetcher } from './utils/api.hook';
import { asList } from '@/lib/response-shape';

export const useAdmin = () => {
  const { data, error, mutate } = useAuthSWR<User[]>('/admin/users');
  const { fetch } = useFetcher();

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

  /** Resolves to null on success, else to the error */
  function updateUser(user: User): Promise<unknown> {
    return failure(() => fetch(`/admin/users/${user._id}`, 'PUT', user), 200);
  }

  /** Resolves to null on success, else to the error */
  function deleteUser(id: string): Promise<unknown> {
    return failure(() => fetch(`/admin/users/${id}`, 'DELETE'), 200);
  }

  /** Resolves to null on success, else to the error */
  function createUser(user: User): Promise<unknown> {
    return failure(() => fetch('/admin/users', 'POST', user), 201);
  }

  /** Move any hunter's Traccar device to a vehicle group (map icon). Throws the axios error on failure. */
  async function setDeviceVehicle(deviceId: number, vehicle: Vehicle): Promise<void> {
    await fetch(`/admin/devices/${deviceId}/vehicle`, 'PUT', { vehicle });
    void mutate();
  }

  return {
    users: asList(data),
    isLoading: !error && !data,
    isError: error,
    updateUser,
    deleteUser,
    createUser,
    setDeviceVehicle,
  };
};
