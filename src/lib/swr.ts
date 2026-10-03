import axios from 'axios';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import useSWR, { SWRConfiguration } from 'swr';
import { REQUEST_TIMEOUT_MS } from '@/lib/http';
import { hasExpectedShape, UnexpectedResponseError } from '@/lib/response-shape';

const baseUrl = import.meta.env.API_BASE_URL;

/**
 * Axios fetcher with method and body handling (+ auth headers)
 * @param url The URL to fetch from / to
 * @param authHeader The authorization header to use
 * @param method The HTTP method to use
 * @param body The body to send with the request
 * @returns The data returned by the API
 */
export const fetcherWithMethod = async (url: string, authHeader: string, method: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH' = 'GET', body?: unknown) => {
  const response = await axios({
    url: `${baseUrl}${url}`,
    method,
    headers: {
      Authorization: authHeader,
    },
    data: body, // Used for POST, PUT, DELETE, etc.
    timeout: REQUEST_TIMEOUT_MS,
  });

  if (response.data?.error) throw new Error(response.data.error);
  return response.data;
};

/** GET for SWR: a malformed answer (proxy page, error object with status 200) fails instead of reaching the components. */
async function swrFetcher([url, authHeader]: [string, string]) {
  const data = await fetcherWithMethod(url, authHeader);
  if (!hasExpectedShape(url, data)) throw new UnexpectedResponseError(url);
  return data;
}

/**
 * Fetch data from the API with authentication.
 * @param url The URL to fetch from / to, or null to skip fetching (SWR conditional fetching)
 * @param options SWR specific options
 * @returns The data returned by the API
 */
export const useAuthSWR = <T>(url: string | null, options?: SWRConfiguration) => {
  const authHeader = useAuthHeader();

  return useSWR<T>(url === null ? null : [url, authHeader], swrFetcher, options);
};
