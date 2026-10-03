import { useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { HintCell } from '@/types/HintCell';
import { formatTime } from './hint-detail.utils';

interface HintNotesProps {
  notes: HintCell['notes'];
  busy: boolean;
  /** Adds the note; calls `clear` once it is saved so the textarea empties */
  onAdd: (text: string, clear: () => void) => void;
}

/**
 * Collapsible list of notes on a hint cell with a textarea to add one.
 */
export default function HintNotes({ notes, busy, onAdd }: HintNotesProps) {
  const [note, setNote] = useState('');
  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex cursor-pointer items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
        {notes.length === 0 ? 'Notitie toevoegen' : `💬 ${notes.length} ${notes.length === 1 ? 'notitie' : 'notities'}`}
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2 pt-2">
        {notes.length > 0 && (
          <ul className="flex flex-col gap-2">
            {notes.map((item) => (
              <li key={item._id} className="rounded-md bg-muted p-2 text-sm">
                <div className="text-xs text-muted-foreground">
                  {item.user?.name ?? 'Onbekend'} · {formatTime(item.createdAt)}
                </div>
                <div className="whitespace-pre-wrap">{item.text}</div>
              </li>
            ))}
          </ul>
        )}
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Bijv. lijkt Ogham, zie regel 2" maxLength={1000} />
        <Button variant="outline" disabled={busy || !note.trim()} onClick={() => onAdd(note.trim(), () => setNote(''))}>
          Notitie toevoegen
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
}
