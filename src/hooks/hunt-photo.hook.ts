import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import useSWR from 'swr';
import { apiErrorStatus } from '@/lib/api-error';
import { fetcherWithMethod } from '@/lib/swr';

const SETTING_REFRESH_MS = 30_000;
const PATH = '/settings/hunt-photo';

/**
 * The effective "Foto bij hunt" value: the loaded value (SWR keeps it through later errors); a failed first load
 * (404 from a server without the setting, or any other error) means photo on, today's flow; undefined while loading.
 */
export function huntPhotoEnabled(data: { enabled: boolean } | undefined, error: unknown): boolean | undefined {
  if (data) return data.enabled;
  return error ? true : undefined;
}

/** GET the setting; a server without it (404) means photo on, without an error (no "Oeps" toast, no retries). */
async function fetchHuntPhoto([url, authHeader]: [string, string]): Promise<{ enabled: boolean }> {
  try {
    const data = (await fetcherWithMethod(url, authHeader)) as { enabled?: unknown };
    if (typeof data?.enabled !== 'boolean') throw new Error('Onverwacht antwoord van /settings/hunt-photo');
    return { enabled: data.enabled };
  } catch (error) {
    if (apiErrorStatus(error) === 404) return { enabled: true };
    throw error;
  }
}

/**
 * Global admin switch "Foto bij hunt". On: hunters photograph the sticker (code read by AI, HQ submits). Off (server
 * default): hunters report a hunt without a photo and confirm it by scanning the fox's QR code on jotihunt.nl.
 * `enabled` (and `photoMode`) is undefined until known: start no hunt flow before then.
 */
export const useHuntPhotoSetting = () => {
  const header = useAuthHeader();
  const { data, error, mutate } = useSWR<{ enabled: boolean }>([PATH, header], fetchHuntPhoto, { refreshInterval: SETTING_REFRESH_MS, revalidateOnFocus: true, focusThrottleInterval: 30_000 });
  const enabled = huntPhotoEnabled(data, error);

  /** Admin only; throws the axios error on failure. */
  async function setEnabled(next: boolean) {
    const result = (await fetcherWithMethod(PATH, header || '', 'PUT', { enabled: next })) as { enabled: boolean };
    await mutate(result, { revalidate: false });
    return result.enabled;
  }

  return { enabled, photoMode: enabled, known: enabled !== undefined, setEnabled };
};
