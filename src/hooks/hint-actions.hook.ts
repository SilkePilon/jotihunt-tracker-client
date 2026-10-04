import { useState } from 'react';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { useHintBoard } from '@/hooks/hints.hook';
import { apiErrorMessage } from '@/lib/api-error';

/** The server's message, else the axios message ("Network Error") or the error itself. */
function errorMessage(error: unknown) {
  return apiErrorMessage(error, isAxiosError(error) ? error.message : String(error));
}

interface SubmitAnswerCallbacks {
  /** The answer was saved */
  onSolved: () => void;
  /** There already is a hint marker for this area and hour; ask before replacing it */
  onExistingMarker: () => void;
}

/**
 * Runs hint board actions for one cell with a shared busy flag and error toasts (409 conflicts get a specific message).
 */
export default function useHintActions(actions: ReturnType<typeof useHintBoard>, articleId: number, area: string) {
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

  async function submitAnswer(answer: string, replaceMarker: boolean, { onSolved, onExistingMarker }: SubmitAnswerCallbacks) {
    setBusy(true);
    try {
      const solved = await actions.solve(articleId, area, answer, { replaceMarker });
      onSolved();
      toast.success(solved.answerKind === 'rd' ? 'Opgelost, hint-marker geplaatst!' : 'Antwoord opgeslagen');
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409 && error.response.data?.existingMarkerId) {
        onExistingMarker();
      } else {
        toast.error('Opslaan mislukt', { description: errorMessage(error) });
      }
    } finally {
      setBusy(false);
    }
  }

  return { busy, run, submitAnswer };
}
