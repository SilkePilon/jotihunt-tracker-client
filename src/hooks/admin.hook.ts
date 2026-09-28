import { useAuthSWR } from '@/lib/swr';
import type { Vehicle } from '@/types/Tracker';
import { User } from '@/types/User';
import { useFetcher } from './utils/api.hook';

export const useAdmin = () => {
  const { data, error, mutate } = useAuthSWR<User[]>('/admin/users');
  const { fetch } = useFetcher();

  /** Run a request and report success; axios throws on 4xx/5xx, which counts as a failure. */
  async function succeeded(request: () => Promise<{ status: number }>, expected: number): Promise<boolean> {
    try {
      return (await request()).status === expected;
    } catch {
      return false;
    } finally {
      void mutate();
    }
  }

  function updateUser(user: User): Promise<boolean> {
    return succeeded(() => fetch(`/admin/users/${user._id}`, 'PUT', user), 200);
  }

  function deleteUser(id: string): Promise<boolean> {
    return succeeded(() => fetch(`/admin/users/${id}`, 'DELETE'), 200);
  }

  function createUser(user: User): Promise<boolean> {
    return succeeded(() => fetch('/admin/users', 'POST', user), 201);
  }

  /** Move any hunter's Traccar device to a vehicle group (map icon). Throws the axios error on failure. */
  async function setDeviceVehicle(deviceId: number, vehicle: Vehicle): Promise<void> {
    await fetch(`/admin/devices/${deviceId}/vehicle`, 'PUT', { vehicle });
    void mutate();
  }

  return {
    users: data,
    isLoading: !error && !data,
    isError: error,
    updateUser,
    deleteUser,
    createUser,
    setDeviceVehicle,
  };
};
