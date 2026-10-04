import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatClock } from '@/lib/format';
import type { HintNote } from '@/types/HintCell';

interface NotesListProps {
  notes: HintNote[];
  busy: boolean;
  /** Adds the note; calls `clear` once it is saved so the textarea empties */
  onAdd: (text: string, clear: () => void) => void;
}

/** The notes of an assignment, always open, with a textarea to add one */
export default function NotesList({ notes, busy, onAdd }: NotesListProps) {
  const [note, setNote] = useState('');
  return (
    <section className="flex flex-col gap-2" aria-label="Notities">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notities</h3>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nog geen notities</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((item) => (
            <li key={item._id} className="rounded-md bg-muted p-2 text-sm">
              <div className="text-xs text-muted-foreground">
                {item.user?.name ?? 'Onbekend'} · {formatClock(item.createdAt)}
              </div>
              <div className="whitespace-pre-wrap break-words">{item.text}</div>
            </li>
          ))}
        </ul>
      )}
      <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Notitie toevoegen…" aria-label="Notitie toevoegen" maxLength={1000} rows={2} />
      <Button type="button" variant="outline" size="sm" className="self-start" disabled={busy || !note.trim()} onClick={() => onAdd(note.trim(), () => setNote(''))}>
        Toevoegen
      </Button>
    </section>
  );
}
