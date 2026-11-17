import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { BeheerCard, BeheerRow, FadeSwap, BeheerRows, RowFrame } from '@/components/beheer/BeheerLayout';
import { Pill } from '@/components/beheer/controls/Pill';
import Segmented from '@/components/beheer/controls/Segmented';
import Reveal from '@/components/motion/Reveal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAssignments } from '@/hooks/assignments.hook';
import { useEdition } from '@/hooks/edition.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { formatClock } from '@/lib/format';
import { ASSIGNMENT_STATUS_LABELS, siteSubmission, statusAuthor } from '@/lib/intel-window';
import type { UserRef } from '@/types/HintCell';
import type { AssignmentStatus, IntelItem } from '@/types/Intel';
import ArticleHtml from './ArticleHtml';
import SiteSubmissionCard from './SiteSubmissionCard';

const STATUS_OPTIONS = (Object.keys(ASSIGNMENT_STATUS_LABELS) as AssignmentStatus[]).map((value) => ({ value, label: ASSIGNMENT_STATUS_LABELS[value] }));
/** Radix Select has no empty value: "Niemand" */
const NO_OWNER = 'none';

/**
 * A control's value while its write runs: shown at once instead of the old value, until the answer is in the cache.
 * Several quick changes: only the latest write's outcome counts; a failure of that one puts the server value back
 * (and toasts).
 */
function useOptimisticWrite<T>(articleId: number, server: T) {
  const [optimistic, setOptimistic] = useState<{ articleId: number; value: T } | null>(null);
  const sequence = useRef(0);

  async function write(next: T, send: () => Promise<unknown>, failure: string) {
    const ticket = ++sequence.current;
    setOptimistic({ articleId, value: next });
    try {
      await send();
    } catch (error) {
      if (ticket === sequence.current) toast.error(apiErrorMessage(error, failure));
    } finally {
      if (ticket === sequence.current) setOptimistic(null);
    }
  }

  // Another assignment opened while a write ran: its own value, not the pending one
  const pending = optimistic?.articleId === articleId;
  return { value: pending ? optimistic.value : server, pending, write };
}

/**
 * Opdracht (spec O): status and owner next to the notes (stacked when the detail is narrow), the full text below. The
 * cards arrive with the detail view (no stagger of their own).
 */
export default function AssignmentPane({ item }: { item: IntelItem }) {
  const { members, setStatus, setOwner, addNote } = useAssignments();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const noteInput = useRef<HTMLInputElement>(null);
  // An archive edition is read-only: status, owner and notes can't change
  const { readOnly } = useEdition();
  const statusWrite = useOptimisticWrite<AssignmentStatus>(item.id, item.assignment?.status ?? 'open');
  const ownerWrite = useOptimisticWrite<string>(item.id, item.assignment?.owner?._id ?? NO_OWNER);
  const status = statusWrite.value;
  const owner = item.assignment?.owner ?? null;
  const notes = item.assignment?.notes ?? [];
  const site = siteSubmission(item.assignment);
  const author = statusAuthor(item.assignment, formatClock);
  // An owner who is no longer a member still shows by name
  const owners: UserRef[] = owner && !members.some((member) => member._id === owner._id) ? [...members, owner] : members;


  async function submitNote() {
    const text = note.trim();
    if (!text || saving || readOnly) return;
    setSaving(true);
    try {
      await addNote(item.id, text);
      // Toevoegen goes disabled with the field emptied: its focus moves to the field, ready for the next note
      const fromButton = document.activeElement instanceof HTMLElement && document.activeElement.dataset.noteAdd !== undefined;
      setNote('');
      if (fromButton) noteInput.current?.focus();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Notitie opslaan mislukt'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="grid items-start gap-3 @min-[680px]:grid-cols-2">
        <div className="min-w-0">
          <BeheerCard>
            <BeheerRows>
              <BeheerRow key="status" title="Status" meta={author && <FadeSwap>{author}</FadeSwap>}>
                <Segmented label="Status" value={status} options={STATUS_OPTIONS} disabled={readOnly} onChange={(next) => void statusWrite.write(next, () => setStatus(item.id, next), 'Status opslaan mislukt')} />
              </BeheerRow>
              <BeheerRow key="owner" title="Eigenaar">
                <Select value={ownerWrite.value} onValueChange={(next) => void ownerWrite.write(next, () => setOwner(item.id, next === NO_OWNER ? null : next), 'Eigenaar opslaan mislukt')} disabled={readOnly}>
                  <SelectTrigger
                    size="sm"
                    aria-label="Eigenaar"
                    aria-busy={ownerWrite.pending || undefined}
                    // Bounded, the name truncates: a long name would otherwise push the row wider than the pane
                    className="max-w-48 min-w-0 px-3 text-caption font-semibold *:data-[slot=select-value]:block *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:truncate"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value={NO_OWNER}>Niemand</SelectItem>
                    {owners.map((member) => (
                      <SelectItem key={member._id} value={member._id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </BeheerRow>
            </BeheerRows>
          </BeheerCard>
          {/* Unfolds when the server sees our submission on jotihunt.nl */}
          <Reveal>
            {site && (
              <div className="pt-3">
                <SiteSubmissionCard site={site} />
              </div>
            )}
          </Reveal>
        </div>
        <div className="min-w-0">
          <BeheerCard title="Notities" count={notes.length}>
            <BeheerRows>
              {notes.map((entry) => (
                <BeheerRow
                  key={entry._id}
                  title={<span className="min-w-0 font-normal break-words whitespace-pre-line">{entry.text}</span>}
                  meta={`${entry.user?.name ?? 'Onbekend'} · ${formatClock(entry.createdAt)}`}
                />
              ))}
              <RowFrame key="new">
                <div className="flex items-center gap-2 px-3 py-2">
                  <input
                    ref={noteInput}
                    aria-label="Notitie toevoegen"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        void submitNote();
                      }
                      // A draft: Escape clears it (data-inline-edit kept the window and the detail open)
                      if (event.key === 'Escape' && note) setNote('');
                    }}
                    readOnly={saving || readOnly}
                    data-inline-edit={note ? '' : undefined}
                    placeholder="Notitie toevoegen…"
                    maxLength={1000}
                    autoComplete="off"
                    data-1p-ignore
                    className="h-8 min-w-0 flex-1 rounded-md bg-beheer-window px-2.5 text-base outline-none desk:text-body placeholder:text-muted-foreground read-only:opacity-60 focus:ring-2 focus:ring-ring"
                  />
                  <Pill variant="primary" disabled={!note.trim() || readOnly} busy={saving} data-note-add onClick={() => void submitNote()}>
                    Toevoegen
                  </Pill>
                </div>
              </RowFrame>
            </BeheerRows>
          </BeheerCard>
        </div>
      </div>
      <div>
        <BeheerCard title="Volledige tekst">
          {/* Capped line length: the opdracht detail is wide */}
          <ArticleHtml html={item.content} className="max-w-[90ch]" />
        </BeheerCard>
      </div>
    </>
  );
}
