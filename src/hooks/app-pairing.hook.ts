import { useState } from 'react';
import { useFetcher } from '@/hooks/utils/api.hook';
import { useAuthSWR } from '@/lib/swr';
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

/** Latest APK on the server; null when there is none (404). */
export const useAppRelease = () => {
  const { data, error } = useAuthSWR<AppRelease>('/app/latest', { shouldRetryOnError: false, revalidateOnFocus: false });
  return { release: error ? null : data };
};
