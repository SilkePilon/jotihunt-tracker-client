import { useState } from 'react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import useSWR from 'swr';
import { useFetcher } from '@/hooks/utils/api.hook';
import { fetchLatestRelease } from '@/lib/app-pairing';
import { fetcherWithMethod } from '@/lib/swr';
import type { AppRelease, PairingCode } from '@/types/Tracker';

/** A one-time pairing code for the Android app; `create` makes a new one (the old one simply expires). */
export const usePairingCode = () => {
  const { fetch } = useFetcher();
  const [pairing, setPairing] = useState<PairingCode | null>(null);
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState(false);

  async function create() {
    setCreating(true);
    setFailed(false);
    try {
      const response = await fetch<PairingCode>('/tracker/pair', 'POST');
      setPairing(response.data);
    } catch {
      setFailed(true);
    } finally {
      setCreating(false);
    }
  }

  return { pairing, creating, failed, create };
};

/**
 * Latest APK on the server. `release` is the release, null when the server has none (404, a normal state) and
 * undefined while loading or when the request failed (`failed`). Plain useSWR on purpose: a missing APK must not
 * trigger the global error toast or the connection indicators.
 */
export const useAppRelease = () => {
  const authHeader = useAuthHeader();
  const { data, error } = useSWR<AppRelease | null>(
    '/app/latest',
    () => fetchLatestRelease<AppRelease>(() => fetcherWithMethod('/app/latest', authHeader ?? '')),
    { shouldRetryOnError: false, revalidateOnFocus: false, onError: () => {}, onSuccess: () => {} },
  );
  return { release: data, failed: !!error };
};
