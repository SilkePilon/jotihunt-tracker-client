import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';

const SETTING_REFRESH_MS = 30_000;
const PATH = '/settings/hunt-photo';

/**
 * Global admin switch "Foto bij hunt". On: hunters photograph the sticker (code read by AI, HQ submits). Off (default):
 * hunters report a hunt without a photo and confirm it by scanning the fox's QR code on jotihunt.nl.
 * `enabled` is undefined until loaded; {@link photoMode} treats that as off (the server default).
 */
export const useHuntPhotoSetting = () => {
  const authHeader = useAuthHeader() || '';
  const { data, mutate } = useAuthSWR<{ enabled: boolean }>(PATH, { refreshInterval: SETTING_REFRESH_MS, revalidateOnFocus: true });

  /** Admin only; throws the axios error on failure. */
  async function setEnabled(enabled: boolean) {
    const result = (await fetcherWithMethod(PATH, authHeader, 'PUT', { enabled })) as { enabled: boolean };
    await mutate(result, { revalidate: false });
    return result.enabled;
  }

  return { enabled: data?.enabled, photoMode: data?.enabled === true, setEnabled };
};
