import { useState } from 'react';
import { CheckIcon, Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Pill, Tag } from '@/components/beheer/controls/Pill';
import { useAssignments } from '@/hooks/assignments.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { sameAnswer } from '@/lib/intel-chat';
import { ASSIGNMENT_STATUS_LABELS } from '@/lib/intel-window';
import type { AssignmentProposal } from '@/types/IntelChat';
import { Row } from './PointCard';

/**
 * proposeAssignmentUpdate card: the assignment, the proposed status and/or note, and "Opslaan" that posts them through the
 * assignments hook (the AI never writes itself; the AssignmentPane follows from the hook's cache). Shows "Opgeslagen ✓"
 * once the assignment holds the proposal, so a reload or a retry after a half failure never posts twice.
 */
export default function AssignmentProposalCard({ proposal }: { proposal: AssignmentProposal }) {
  const { assignments, setStatus, addNote } = useAssignments();
  const assignment = assignments?.find((existing) => existing.articleId === proposal.articleId);
  const currentStatus = assignment?.status ?? 'open';
  const note = proposal.note?.trim() || null;
  const statusDone = !proposal.status || currentStatus === proposal.status;
  const noteDone = !note || (assignment?.notes ?? []).some((existing) => sameAnswer(existing.text, note));
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  // Before the list loaded nothing is known yet: offer "Opslaan". justSaved only bridges until the cache reflects the save
  const saved = assignments === undefined ? justSaved : statusDone && noteDone;

  async function save() {
    if (saved || saving) return;
    setSaving(true);
    try {
      if (proposal.status && !statusDone) await setStatus(proposal.articleId, proposal.status);
      if (note && !noteDone) await addNote(proposal.articleId, note);
      setJustSaved(true);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Opdracht bijwerken mislukt'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-[18px] bg-beheer-row">
      <div className="grid gap-1.5 px-3 py-2.5 text-[12.5px]">
        <div className="truncate text-[13px] font-semibold">{proposal.title}</div>
        {proposal.status && (
          <Row name="Status">
            <Tag tone="primary">{ASSIGNMENT_STATUS_LABELS[proposal.status]}</Tag>
          </Row>
        )}
        {note && (
          <div className="grid gap-0.5">
            <span className="text-muted-foreground">Notitie</span>
            <p className="break-words whitespace-pre-wrap">{note}</p>
          </div>
        )}
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Pill variant={saved ? 'success' : 'primary'} disabled={saving} aria-disabled={saved} onClick={save} morphKey={saved ? 'saved' : saving ? 'saving' : 'idle'}>
            {saved ? (
              <>
                Opgeslagen
                <CheckIcon />
              </>
            ) : saving ? (
              <Loader2Icon className="animate-spin" aria-label="Opslaan…" />
            ) : (
              <>
                <CheckIcon />
                Opslaan
              </>
            )}
          </Pill>
        </div>
      </div>
    </div>
  );
}
