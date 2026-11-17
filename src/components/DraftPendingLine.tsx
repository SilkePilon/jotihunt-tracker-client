import { CircleAlertIcon } from 'lucide-react';
import Reveal from '@/components/motion/Reveal';
import { COARSE_HIT_AREA } from '@/lib/hit-area';
import { cn } from '@/lib/utils';
import useMarkerDraftStore, { latestDraft, pendingDraftLine, reopenDraft } from '@/stores/marker-draft.store';

/**
 * "1 hunt niet bevestigd — tik om te controleren" while a Hunt / Spot save is kept unconfirmed (marker-draft.store), in
 * the error tone; folds in and away. A tap reopens the dialog at the latest draft's pin (MarkerRegistrationHost flies
 * the map there). The phone's peek strip (same row as the tracker line) and the laptop sidebar header show it.
 * @param gap The parent's flex gap in px (Reveal: folded away it takes no space)
 * @param className Its text size (the peek's tracker line size, the sidebar header's body size) and spacing
 */
export default function DraftPendingLine({ gap = 0, className }: { gap?: number; className?: string }) {
  const drafts = useMarkerDraftStore((state) => state.drafts);
  const line = pendingDraftLine(drafts);
  return (
    <Reveal gap={gap}>
      {line && (
        <button
          type="button"
          onClick={() => {
            const draft = latestDraft(useMarkerDraftStore.getState().drafts);
            if (draft) reopenDraft(draft);
          }}
          className={cn(
            'flex min-h-9 w-full items-center gap-2 rounded-md text-left font-semibold text-destructive-text outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset',
            COARSE_HIT_AREA,
            className,
          )}
        >
          <CircleAlertIcon aria-hidden className="size-4 shrink-0" />
          <span className="min-w-0 truncate">{line}</span>
        </button>
      )}
    </Reveal>
  );
}
