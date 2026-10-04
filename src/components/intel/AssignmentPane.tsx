import { useId, useState } from 'react';
import { isAxiosError } from 'axios';
import { ExternalLinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAssignments } from '@/hooks/assignments.hook';
import { useGuardedWrite } from '@/hooks/guarded-write.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { formatClock } from '@/lib/format';
import { ASSIGNMENT_STATUS_LABELS, othersOnItem } from '@/lib/intel';
import type { AssignmentStatus, IntelItem, PresenceEntry } from '@/types/Intel';
import DeadlineBox from './DeadlineBox';
import NotesList from './NotesList';
import OverwriteDialog from './OverwriteDialog';
import PresenceBar from './PresenceBar';

const STATUSES = Object.keys(ASSIGNMENT_STATUS_LABELS) as AssignmentStatus[];
const LABEL = 'shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground';

interface AssignmentPaneProps {
  item: IntelItem;
  now: number;
  assignments: ReturnType<typeof useAssignments>;
  presence: PresenceEntry[];
  selfId?: string;
}

/**
 * The right pane for an assignment: the deadline, our status, who does it and the notes. Changing the status or the
 * owner asks before overwriting what someone else set.
 */
export default function AssignmentPane({ item, now, assignments, presence, selfId }: AssignmentPaneProps) {
  const guard = useGuardedWrite();
  const [noteBusy, setNoteBusy] = useState(false);
  const statusLabelId = useId();

  const { assignment } = item;
  const status = assignment?.status ?? 'open';
  const owner = assignment?.owner ?? null;
  const selfName = assignments.members.find((member) => member._id === selfId)?.name ?? 'jij';
  // Giving it to who already has it is not a choice
  const assignable = assignments.members.filter((member) => member._id !== owner?._id);

  /** Someone else was first: fetch the bookkeeping, so the pane shows their value behind the dialog */
  function refresh() {
    void assignments.refresh();
  }

  function setStatus(next: AssignmentStatus) {
    void guard.run((flags) => assignments.setStatus(item.id, next, flags.overwrite), ASSIGNMENT_STATUS_LABELS[next], undefined, refresh);
  }

  function setOwner(ownerId: string | null, name: string) {
    void guard.run((flags) => assignments.setOwner(item.id, ownerId, flags.overwrite), name, undefined, refresh);
  }

  async function addNote(text: string, clear: () => void) {
    setNoteBusy(true);
    try {
      await assignments.addNote(item.id, text);
      clear();
    } catch (error) {
      toast.error('Opslaan mislukt', { description: apiErrorMessage(error, isAxiosError(error) ? error.message : String(error)) });
    } finally {
      setNoteBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <PresenceBar entries={othersOnItem(presence, item.id, selfId)} />
      {item.endTime && <DeadlineBox endTime={item.endTime} now={now} status={status} />}

      <div className="flex flex-col gap-1.5">
        <span id={statusLabelId} className={LABEL}>
          Status
        </span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          className="w-full"
          aria-labelledby={statusLabelId}
          value={status}
          disabled={guard.busy}
          // Radix gives '' when the pressed one is clicked again: the status stays
          onValueChange={(value) => value && value !== status && setStatus(value as AssignmentStatus)}
        >
          {STATUSES.map((key) => (
            <ToggleGroupItem key={key} value={key} className="flex-1 px-1.5 text-xs">
              {ASSIGNMENT_STATUS_LABELS[key]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {assignment?.statusBy && (
          <p className="text-xs text-muted-foreground">
            door {assignment.statusBy.name}
            {assignment.statusAt && <> · {formatClock(assignment.statusAt)}</>}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={LABEL}>Door</span>
          <span className={owner ? 'min-w-0 truncate text-sm font-semibold' : 'text-sm text-muted-foreground'}>{owner?.name ?? 'niemand'}</span>
          <span className="ml-auto flex items-center gap-1">
            {selfId && owner?._id !== selfId && (
              <Button type="button" size="sm" disabled={guard.busy} onClick={() => setOwner(selfId, selfName)}>
                Ik pak deze
              </Button>
            )}
            {owner && (
              <Button type="button" variant="ghost" size="sm" disabled={guard.busy} onClick={() => setOwner(null, 'niemand')}>
                Loslaten
              </Button>
            )}
          </span>
        </div>
        {assignable.length > 0 && (
          // The value stays empty: the select is an action, the owner shows above
          <Select value="" disabled={guard.busy} onValueChange={(memberId) => setOwner(memberId, assignable.find((member) => member._id === memberId)?.name ?? '')}>
            <SelectTrigger size="sm" className="w-full" aria-label="Toewijzen aan">
              <SelectValue placeholder="Toewijzen aan…" />
            </SelectTrigger>
            <SelectContent>
              {assignable.map((member) => (
                <SelectItem key={member._id} value={member._id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Button asChild variant="outline" size="sm" className="self-start">
        <a href="https://jotihunt.nl" target="_blank" rel="noreferrer">
          Inleveren op jotihunt.nl
          <ExternalLinkIcon aria-hidden />
        </a>
      </Button>

      <NotesList notes={assignment?.notes ?? []} busy={noteBusy} onAdd={addNote} />
      <OverwriteDialog guard={guard} />
    </div>
  );
}
