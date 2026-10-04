import { useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api-error';
import { nextWriteStep } from '@/lib/intel';
import type { WriteConflict, WriteFlags } from '@/types/Intel';

type Write = (flags: WriteFlags) => Promise<unknown>;

export interface PendingWrite {
  /** What the write would overwrite; null when only an existing hint marker is in the way */
  conflict: WriteConflict | null;
  marker: boolean;
  /** The value the user is trying to write, for the dialog */
  newValue: string;
}

/**
 * Runs a write that the server may refuse with a conflict (someone else's value) or an existing hint marker. The
 * refusal becomes `pending`, which the overwrite dialog shows; `confirm` repeats the write with the flag that lets it
 * through. Other errors are toasted. While a write is under way, `run` and `confirm` do nothing. `onRefused` runs
 * when the server refused the write because of someone else's value, so the caller can fetch that value at once.
 */
export function useGuardedWrite() {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingWrite | null>(null);
  const retry = useRef<{ write: Write; flags: WriteFlags; newValue: string; onDone?: () => void; onRefused?: () => void } | null>(null);

  /** Set while a write is under way: `busy` only shows it a render later */
  const inFlight = useRef(false);

  async function attempt(write: Write, flags: WriteFlags, newValue: string, onDone?: () => void, onRefused?: () => void) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    let saved = false;
    let refused = false;
    try {
      await write(flags);
      saved = true;
      retry.current = null;
      setPending(null);
    } catch (error) {
      const step = nextWriteStep(error, flags);
      if (step.ask === 'error') {
        retry.current = null;
        setPending(null);
        toast.error('Opslaan mislukt', { description: apiErrorMessage(error, isAxiosError(error) ? error.message : String(error)) });
      } else {
        refused = step.ask === 'conflict';
        retry.current = { write, flags: step.flags, newValue, onDone, onRefused };
        setPending({ conflict: step.conflict, marker: step.ask === 'marker', newValue });
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
    // Outside the try: an error in onDone is not a failed save
    if (saved) onDone?.();
    if (refused) onRefused?.();
  }

  return {
    busy,
    pending,
    /** Try the write without overwriting anything; `onRefused` when someone else's value is in the way */
    run: (write: Write, newValue: string, onDone?: () => void, onRefused?: () => void) => attempt(write, { overwrite: false, replaceMarker: false }, newValue, onDone, onRefused),
    /** The user confirmed the dialog: repeat the write, now allowed to overwrite */
    confirm: async () => {
      const next = retry.current;
      if (next) await attempt(next.write, next.flags, next.newValue, next.onDone, next.onRefused);
    },
    cancel: () => {
      retry.current = null;
      setPending(null);
    },
  };
}

export type GuardedWrite = ReturnType<typeof useGuardedWrite>;
