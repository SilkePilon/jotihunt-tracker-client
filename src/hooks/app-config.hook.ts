import axios from 'axios';
import { useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { REQUEST_TIMEOUT_MS } from '@/lib/http';
import { useAppConfigStore, type PublicConfig } from '@/lib/app-config';

const baseUrl = import.meta.env.API_BASE_URL;
/** Settings change a few times per game: refetch on focus and every minute */
const CONFIG_REFRESH_MS = 60_000;

/** Public, so no auth header: the invite and login pages need the name and logo too. */
async function fetchConfig(url: string): Promise<PublicConfig> {
  const { data } = await axios.get<PublicConfig>(`${baseUrl}${url}`, { timeout: REQUEST_TIMEOUT_MS });
  if (typeof data !== 'object' || data === null || typeof data.logoUrl !== 'string') throw new Error('Unexpected /config answer');
  return data;
}

/** Mounted once at the root: keeps the config store in step with the server. Renders nothing. */
export function AppConfigSync() {
  const { data } = useSWR('/config', fetchConfig, { refreshInterval: CONFIG_REFRESH_MS, revalidateOnFocus: true, focusThrottleInterval: 30_000 });
  const setConfig = useAppConfigStore((state) => state.setConfig);
  useEffect(() => {
    if (data) setConfig(data);
  }, [data, setConfig]);
  return null;
}

/** The public config; re-renders when an admin changes it. */
export function useAppConfig() {
  const config = useAppConfigStore((state) => state.config);
  const loaded = useAppConfigStore((state) => state.loaded);
  return { ...config, loaded };
}

/** Refetch /config now (after an admin saved). */
export const revalidateAppConfig = () => mutate('/config');
