import axios, { isAxiosError } from 'axios';
import { useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { REQUEST_TIMEOUT_MS, SLOW_REQUEST_TIMEOUT_MS } from '@/lib/http';
import { apiErrorMessage } from '@/lib/api-error';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import { useAppConfigStore, type AdminConfig, type AiSlot, type GeneralPatch, type ModelList, type PlainName, type PublicConfig, type SecretName } from '@/lib/app-config';

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

export function useAdminConfig() {
  const authHeader = useAuthHeader() || '';
  const { data, error, mutate } = useAuthSWR<AdminConfig>('/admin/config');

  async function send(url: string, method: 'PUT' | 'POST' | 'DELETE', body?: unknown): Promise<AdminConfig> {
    const next = (await fetcherWithMethod(url, authHeader, method, body)) as AdminConfig;
    await mutate(next, { revalidate: false });
    void revalidateAppConfig();
    return next;
  }

  return {
    config: data,
    isError: !!error,
    saveGeneral: (patch: GeneralPatch) => send('/admin/config/general', 'PUT', patch),
    saveSecret: (name: SecretName, value: string) => send(`/admin/config/secrets/${name}`, 'PUT', { value }),
    clearSecret: (name: SecretName) => send(`/admin/config/secrets/${name}`, 'DELETE'),
    savePlain: (patch: Partial<Record<PlainName, string | null>>) => send('/admin/config/plain', 'PUT', patch),
    saveModels: (models: Partial<Record<AiSlot, string | null>>) => send('/admin/ai/models', 'PUT', { models }),
    uploadLogo: (file: File) => {
      const form = new FormData();
      form.append('logo', file);
      return send('/admin/config/logo', 'POST', form);
    },
  };
}

export function useAiModels(enabled: boolean) {
  const authHeader = useAuthHeader() || '';
  const { data, error, mutate } = useAuthSWR<ModelList>(enabled ? '/admin/ai/models' : null, { revalidateOnFocus: false, shouldRetryOnError: false });
  const status = (error as { response?: { status?: number; data?: { code?: string } } } | undefined)?.response;
  return {
    models: data?.models,
    fetchedAt: data?.fetchedAt,
    error: error ? apiErrorMessage(error, 'Lijst niet beschikbaar') : undefined,
    keyRejected: status?.data?.code === 'key_rejected',
    refresh: async () => {
      await mutate((await fetcherWithMethod('/admin/ai/models?refresh=1', authHeader)) as ModelList, { revalidate: false });
    },
    /** Plain refetch (the server's list cache is per key), so a rejected new key shows up as `keyRejected` */
    revalidate: () => mutate(),
  };
}

type TestResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * POST a server-side test that answers 200 with `{ ok, error? }`. fetcherWithMethod throws on any `data.error`, so a
 * failed test (and a network error or timeout) comes back as `{ ok: false, error }` here instead of a rejection.
 */
async function runTest<T extends object>(url: string, authHeader: string, body?: unknown): Promise<TestResult<T>> {
  try {
    return (await fetcherWithMethod(url, authHeader, 'POST', body, SLOW_REQUEST_TIMEOUT_MS)) as TestResult<T>;
  } catch (error) {
    const fallback = error instanceof Error && !isAxiosError(error) ? error.message : 'Test mislukt';
    return { ok: false, error: apiErrorMessage(error, fallback) };
  }
}

export function testAiSlot(slot: AiSlot, authHeader: string): Promise<TestResult<{ ms: number }>> {
  return runTest(`/admin/ai/test/${slot}`, authHeader);
}

export function useTraccarGroups(enabled: boolean) {
  const { data, error } = useAuthSWR<{ id: number; name: string }[]>(enabled ? '/admin/traccar/groups' : null, { revalidateOnFocus: false });
  return { groups: data, isError: !!error };
}

export function testJotihuntLogin(authHeader: string, login?: { username: string; password: string }): Promise<TestResult> {
  return runTest('/admin/jotihunt/test-login', authHeader, login ?? {});
}
