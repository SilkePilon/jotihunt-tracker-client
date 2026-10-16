import axios from 'axios';
import { useState } from 'react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import useSWR, { type KeyedMutator, SWRConfiguration } from 'swr';
import useSWRInfinite, { type SWRInfiniteConfiguration } from 'swr/infinite';
import { REQUEST_TIMEOUT_MS, SLOW_REQUEST_TIMEOUT_MS } from '@/lib/http';
import { hasExpectedShape, UnexpectedResponseError } from '@/lib/response-shape';
import { reportFetchError, reportFetchSuccess } from '@/lib/connection';

const baseUrl = import.meta.env.API_BASE_URL;

/**
 * Axios fetcher with method and body handling (+ auth headers)
 * @param url The URL to fetch from / to
 * @param authHeader The authorization header to use
 * @param method The HTTP method to use
 * @param body The body to send with the request
 * @param timeoutMs Request timeout; use SLOW_REQUEST_TIMEOUT_MS for calls the server needs long for
 * @returns The data returned by the API
 */
export const fetcherWithMethod = async (
  url: string,
  authHeader: string,
  method: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH' = 'GET',
  body?: unknown,
  timeoutMs = REQUEST_TIMEOUT_MS,
) => {
  const response = await axios({
    url: `${baseUrl}${url}`,
    method,
    headers: {
      Authorization: authHeader,
    },
    data: body, // Used for POST, PUT, DELETE, etc.
    timeout: timeoutMs,
  });

  if (response.data?.error) throw new Error(response.data.error);
  return response.data;
};

/** GET a file (image) from the API with the auth header, which <img src> and canvas image loads can't send. */
export async function fetchAuthBlob(path: string, authHeader: string): Promise<Blob> {
  const response = await axios.get<Blob>(`${baseUrl}${path}`, { headers: { Authorization: authHeader }, responseType: 'blob' });
  return response.data;
}

/** GET for SWR: a malformed answer (proxy page, error object with status 200) fails instead of reaching the components. */
async function swrFetcher([url, authHeader]: [string, string]) {
  try {
    const data = await fetcherWithMethod(url, authHeader);
    if (!hasExpectedShape(url, data)) throw new UnexpectedResponseError(url);
    reportFetchSuccess();
    return data;
  } catch (error) {
    reportFetchError();
    throw error;
  }
}

/** Coming back to the app (focus) refetches at most this often, instead of ~15 endpoints on every switch back. */
const FOCUS_THROTTLE_MS = 30_000;

/**
 * Fetch data from the API with authentication.
 * @param url The URL to fetch from / to, or null to skip fetching (SWR conditional fetching)
 * @param options SWR specific options
 * @returns The data returned by the API
 */
export const useAuthSWR = <T>(url: string | null, options?: SWRConfiguration) => {
  const authHeader = useAuthHeader();

  return useSWR<T>(url === null ? null : [url, authHeader], swrFetcher, { focusThrottleInterval: FOCUS_THROTTLE_MS, ...options });
};

/**
 * Paged {@link useAuthSWR}: `pathFor(index, previousPage)` gives each page's URL, null after the last page.
 */
export function useAuthSWRInfinite<T>(pathFor: ((index: number, previous: T | null) => string | null) | null, options?: SWRInfiniteConfiguration) {
  const authHeader = useAuthHeader();
  return useSWRInfinite<T>(
    (index, previous: T | null) => {
      if (!pathFor) return null;
      const path = pathFor(index, previous);
      return path === null ? null : [path, authHeader];
    },
    swrFetcher,
    { focusThrottleInterval: FOCUS_THROTTLE_MS, ...options },
  );
}

/**
 * {@link useAuthSWR} whose poll interval follows the latest data (e.g. fast while linking, slow once linked). The
 * interval is a plain number kept in state and adjusted during render when the data changes.
 * @param initialInterval The interval before the first answer
 */
export function useAdaptiveSWR<T>(url: string | null, intervalFor: (data: T | undefined) => number, initialInterval: number) {
  const [refreshInterval, setRefreshInterval] = useState(initialInterval);
  const result = useAuthSWR<T>(url, { refreshInterval });
  const nextInterval = intervalFor(result.data);
  if (nextInterval !== refreshInterval) setRefreshInterval(nextInterval);
  return result;
}

/**
 * An admin action that answers with the new status (slow timeout): the answer replaces the cached status. On failure
 * (e.g. 409 or 503) the status is refetched, to show what the server has now instead of a stale state, and the error
 * is rethrown.
 */
export function useStatusAction<T>(mutate: KeyedMutator<T>) {
  const authHeader = useAuthHeader() || '';
  return async (url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> => {
    try {
      const status = (await fetcherWithMethod(url, authHeader, method, body, SLOW_REQUEST_TIMEOUT_MS)) as T;
      await mutate(status, { revalidate: false });
      return status;
    } catch (error) {
      void mutate();
      throw error;
    }
  };
}
