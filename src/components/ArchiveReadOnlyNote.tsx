import { LockIcon } from 'lucide-react';
import Reveal from '@/components/motion/Reveal';
import { useEdition } from '@/hooks/edition.hook';
import { cn } from '@/lib/utils';

/**
 * "Archief 2025 — alleen-lezen" under an action that an archive edition disables, so the greyed-out button has a
 * reason. Unfolds in and folds away with the edition.
 * @param gap The parent's flex gap in px (see Reveal)
 * @param className Colour/spacing for where it sits (map popups use the popup's muted colour)
 */
export default function ArchiveReadOnlyNote({ gap = 0, className }: { gap?: number; className?: string }) {
  const { state } = useEdition();
  const year = state?.readOnly ? state.shownYear : null;
  return (
    <Reveal gap={gap}>
      {year !== null && (
        <p className={cn('flex items-center gap-1.5 text-xs font-medium text-muted-foreground', className)}>
          <LockIcon aria-hidden className="size-3 shrink-0" />
          Archief {year} — alleen-lezen
        </p>
      )}
    </Reveal>
  );
}
