import { Marker } from '@/types/Marker';
import { fetcherWithMethod, useAuthSWR } from '../lib/swr';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { asList, hasExpectedShape } from '@/lib/response-shape';

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
   * Fetch the marker list now, bypassing SWR's dedupe (a poll may have just failed too), and put it in the cache.
   * @returns The fresh list, or undefined when the fetch failed (never throws)
   */
  async function fetchFreshMarkers(): Promise<Marker[] | undefined> {
    try {
      const fresh: unknown = await fetcherWithMethod('/markers', authHeader);
      if (!hasExpectedShape('/markers', fresh)) return undefined;
      await mutate(fresh as Marker[], { revalidate: false });
      return fresh as Marker[];
    } catch {
      return undefined;
    }
  }

  /**
   * Delete a marker via the API.
   * @param markerId The ID of the marker to delete
   * @returns null if the marker was deleted, else the error (never throws; show it with apiErrorMessage)
   */
  async function deleteMarker(markerId: string): Promise<unknown> {
    let result;
    try {
      result = await fetcherWithMethod(`/markers/${markerId}`, authHeader, 'DELETE');
    } catch (error) {
      return error ?? new Error('Request failed');
    }
    if (!result) return new Error('Unexpected response');
    mutate((data) => {
      if (data) {
        return data.filter((marker) => marker._id !== markerId);
      }
      return [];
    });
    return null;
  }

  return {
    markers: asList(data),
    isLoading: !error && !data,
    isError: error,
    /** A list has come in (a later failed poll keeps it); until then it isn't known which hint hours are taken */
    loaded: data !== undefined,
    /** Refetch now (LoadError's retry) */
    retry: () => mutate(),
    createMarker,
    fetchFreshMarkers,
    deleteMarker,
  };
};
