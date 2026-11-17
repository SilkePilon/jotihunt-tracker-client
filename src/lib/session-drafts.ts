import { savePage } from '@/lib/continuity';
import useHintDraftStore from '@/stores/hint-draft.store';
import useMarkerDraftStore from '@/stores/marker-draft.store';

/**
 * Forget what this device kept for the session that ends (logout) or the edition that is left: unconfirmed Hunt/Spot
 * drafts, the typed hint and its unconfirmed send, and the phone page a reload would reopen. None of it belongs to
 * the next user or the other edition.
 */
export function clearSessionDrafts() {
  useMarkerDraftStore.getState().clearAll();
  const hint = useHintDraftStore.getState();
  hint.clear();
  hint.setPending(null);
  savePage(null);
}
