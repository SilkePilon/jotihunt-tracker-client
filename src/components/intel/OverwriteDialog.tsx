import { useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { GuardedWrite, PendingWrite } from '@/hooks/guarded-write.hook';
import { formatClock } from '@/lib/format';
import { ASSIGNMENT_STATUS_LABELS, conflictText, distanceMeters } from '@/lib/intel';
import type { AssignmentStatus, WriteConflict } from '@/types/Intel';

interface OverwriteDialogProps {
  /** The guarded write whose refusal this dialog asks about */
  guard: GuardedWrite;
  /** [lng, lat] of the value that stands now, for the distance line */
  currentLocation?: [number, number];
  /** [lng, lat] of the value being written */
  newLocation?: [number, number];
}

const MARKER_TEXT = {
  title: 'Hint-marker vervangen?',
  description: 'Er staat al een hint-marker voor dit deelgebied op dit uur. Wil je die vervangen door dit antwoord?',
  confirm: 'Vervangen',
};

const LABEL_CLASS = 'w-14 shrink-0 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase';

/** The value that stands now, as shown in the "Nu" row */
function currentValue(conflict: WriteConflict): string {
  if (conflict.kind === 'claim') return 'bezig';
  if (conflict.kind === 'status') return ASSIGNMENT_STATUS_LABELS[conflict.value as AssignmentStatus] ?? conflict.value ?? '';
  return conflict.value ?? '';
}

/** "280 m", or "1,2 km" from a kilometre */
function formatDistance(meters: number): string {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

/**
 * Asks before a guarded write overwrites someone else's value (or replaces an existing hint marker), showing the
 * current and the new value side by side.
 */
export default function OverwriteDialog({ guard, currentLocation, newLocation }: OverwriteDialogProps) {
  // Keep the last question on screen while the dialog animates out (pending is null by then)
  const [shown, setShown] = useState<PendingWrite | null>(guard.pending);
  if (guard.pending && guard.pending !== shown) setShown(guard.pending);

  const pending = guard.pending ?? shown;
  const conflict = pending?.conflict ?? null;
  const text = conflict ? conflictText(conflict) : MARKER_TEXT;
  const who = conflict ? [conflict.by?.name, conflict.at ? formatClock(conflict.at) : undefined].filter(Boolean).join(' · ') : '';

  return (
    <ConfirmDialog
      open={guard.pending !== null}
      onOpenChange={(open) => {
        if (!open) guard.cancel();
      }}
      title={text.title}
      description={text.description}
      confirmLabel={text.confirm}
      destructive
      // The hook closes the dialog (or opens the next question) by itself
      onConfirm={guard.confirm}
    >
      {conflict && pending && (
        <div className="space-y-2 rounded-lg border bg-card p-3 text-sm">
          <div className="flex items-baseline gap-2">
            <span className={LABEL_CLASS}>Nu</span>
            <span className="min-w-0 flex-1 font-mono font-semibold break-words">{currentValue(conflict)}</span>
            {who && <span className="shrink-0 text-xs text-muted-foreground">{who}</span>}
          </div>
          <div className="flex items-baseline gap-2">
            <span className={LABEL_CLASS}>Nieuw</span>
            <span className="min-w-0 flex-1 font-mono font-semibold break-words text-primary">{pending.newValue}</span>
            <span className="shrink-0 text-xs text-muted-foreground">jij</span>
          </div>
          {currentLocation && newLocation && (
            <p className="text-xs text-muted-foreground">Verschil: {formatDistance(distanceMeters(currentLocation, newLocation))}. De marker op de kaart verhuist mee.</p>
          )}
        </div>
      )}
    </ConfirmDialog>
  );
}
