import { useState } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { BeheerCard, BeheerRow, BeheerRows, RowFrame } from '@/components/beheer/BeheerLayout';
import { Pill } from '@/components/beheer/controls/Pill';
import Segmented from '@/components/beheer/controls/Segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAssignments } from '@/hooks/assignments.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { formatClock } from '@/lib/format';
import { ASSIGNMENT_STATUS_LABELS, DETAIL_PART } from '@/lib/intel-window';
import type { UserRef } from '@/types/HintCell';
import type { AssignmentStatus, IntelItem } from '@/types/Intel';
import ArticleHtml from './ArticleHtml';

const STATUS_OPTIONS = (Object.keys(ASSIGNMENT_STATUS_LABELS) as AssignmentStatus[]).map((value) => ({ value, label: ASSIGNMENT_STATUS_LABELS[value] }));
/** Radix Select has no empty value: "Niemand" */
const NO_OWNER = 'none';

/**
 * Opdracht (spec O): status and owner next to the notes (stacked when the detail is narrow), the full text below. Each
 * card is one staggered part of the detail.
 */
export default function AssignmentPane({ item }: { item: IntelItem }) {
  const { members, setStatus, setOwner, addNote } = useAssignments();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const status = item.assignment?.status ?? 'open';
  const owner = item.assignment?.owner ?? null;
  const notes = item.assignment?.notes ?? [];
  // An owner who is no longer a member still shows by name
  const owners: UserRef[] = owner && !members.some((member) => member._id === owner._id) ? [...members, owner] : members;

  const run = (write: () => Promise<unknown>, failure: string) => void write().catch((error: unknown) => toast.error(apiErrorMessage(error, failure)));

  async function submitNote() {
    const text = note.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      await addNote(item.id, text);
      setNote('');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Notitie opslaan mislukt'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="grid items-start gap-3 @min-[680px]:grid-cols-2">
        <motion.div variants={DETAIL_PART} className="min-w-0">
          <BeheerCard>
            <BeheerRows>
              <BeheerRow key="status" title="Status">
                <Segmented label="Status" value={status} options={STATUS_OPTIONS} onChange={(next) => run(() => setStatus(item.id, next), 'Status opslaan mislukt')} />
              </BeheerRow>
              <BeheerRow key="owner" title="Eigenaar">
                <Select value={owner?._id ?? NO_OWNER} onValueChange={(next) => run(() => setOwner(item.id, next === NO_OWNER ? null : next), 'Eigenaar opslaan mislukt')}>
                  <SelectTrigger
                    size="sm"
                    aria-label="Eigenaar"
                    className="rounded-lg border-0 bg-beheer-row-high px-3 text-[12.5px] font-semibold shadow-none hover:bg-beheer-row-high/70 dark:bg-beheer-row-high dark:hover:bg-beheer-row-high/70"
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
        </motion.div>
        <motion.div variants={DETAIL_PART} className="min-w-0">
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
                    aria-label="Notitie toevoegen"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        void submitNote();
                      }
                    }}
                    readOnly={saving}
                    placeholder="Notitie toevoegen…"
                    maxLength={1000}
                    autoComplete="off"
                    data-1p-ignore
                    className="h-8 min-w-0 flex-1 rounded-[10px] bg-beheer-window px-2.5 text-[13px] ring-1 ring-border outline-none placeholder:text-muted-foreground read-only:opacity-60 focus:ring-primary"
                  />
                  <Pill variant="primary" disabled={!note.trim() || saving} onClick={() => void submitNote()}>
                    Toevoegen
                  </Pill>
                </div>
              </RowFrame>
            </BeheerRows>
          </BeheerCard>
        </motion.div>
      </div>
      <motion.div variants={DETAIL_PART}>
        <BeheerCard title="Volledige tekst">
          {/* Capped line length: the opdracht detail is wide */}
          <ArticleHtml html={item.content} className="max-w-[90ch]" />
        </BeheerCard>
      </motion.div>
    </>
  );
}
