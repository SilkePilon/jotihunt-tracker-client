import axios from 'axios';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { REQUEST_TIMEOUT_MS } from '@/lib/http';

export const useFetcher = () => {
  const baseUrl = import.meta.env.API_BASE_URL;
  const authHeader = useAuthHeader();

  /** `timeoutMs` overrides the default request timeout for slow calls (e.g. the edition switch). */
  async function fetch<T>(url: string, method: 'GET' | 'POST' | 'DELETE' | 'PUT' = 'GET', body?: unknown, timeoutMs = REQUEST_TIMEOUT_MS) {
    return axios.request<T>({
      url: `${baseUrl}${url}`,
      method,
      headers: {
        Authorization: authHeader,
      },
      data: body, // Used for POST, PUT, DELETE, etc.
      timeout: timeoutMs,
    });
  }

  return {
    fetch,
  };
};
