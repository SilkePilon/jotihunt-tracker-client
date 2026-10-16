import { Marker } from '@/types/Marker';
import { fetcherWithMethod, useAuthSWR } from '../lib/swr';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { asList } from '@/lib/response-shape';

export const useMarkers = () => {
  const authHeader = useAuthHeader() || '';

  const { data, error, mutate } = useAuthSWR<Marker[]>('/markers', {
    refreshInterval: 5000,
    // Several components use this hook: one request per poll, not one per mount
    dedupingInterval: 5000,
  });

  /**
   * Create a new marker via the API.
   * Updates the local state with the new marker.
   * @param marker The marker to create
   * @returns null if the marker was created, else the error (never throws; show it with apiErrorMessage)
   */
  async function createMarker(marker: Marker): Promise<unknown> {
    let result;
    try {
      result = await fetcherWithMethod('/markers', authHeader, 'POST', marker);
    } catch (error) {
      return error ?? new Error('Request failed');
    }
    if (!result?._id) return new Error('Unexpected response');
    mutate((data) => {
      if (data) {
        return [...data, result];
      }
      return [result];
    });
    return null;
  }

  /**
   * Delete a marker via the API.
   * @param markerId The ID of the marker to delete
   * @returns True if the marker was deleted successfully, false otherwise (never throws)
   */
  async function deleteMarker(markerId: string): Promise<boolean> {
    const result = await fetcherWithMethod(`/markers/${markerId}`, authHeader, 'DELETE').catch(() => null);
    if (result) {
      mutate((data) => {
        if (data) {
          return data.filter((marker) => marker._id !== markerId);
        }
        return [];
      });
      return true;
    }
    return false;
  }

  return {
    markers: asList(data),
    isLoading: !error && !data,
    isError: error,
    createMarker,
    deleteMarker,
  };
};
