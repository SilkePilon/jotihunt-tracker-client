import { useState } from 'react';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api-error';

/** The server's message, else the axios message ("Network Error") or the error itself. */
function errorMessage(error: unknown) {
  return apiErrorMessage(error, isAxiosError(error) ? error.message : String(error));
}

/**
 * Runs the unguarded hint board actions (release, check, notes, status) with a shared busy flag and error toasts.
 * Claims and answers, which can overwrite someone else's work, go through `useGuardedWrite` instead.
 */
export default function useHintActions() {
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, success?: string) {
    setBusy(true);
    try {
      await action();
      if (success) toast.success(success);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409 && error.response.data?.claimedBy) {
        toast.error(`Al geclaimd door ${error.response.data.claimedBy.name}`);
      } else {
        toast.error('Actie mislukt', { description: errorMessage(error) });
      }
    } finally {
      setBusy(false);
    }
  }

  return { busy, run };
}
