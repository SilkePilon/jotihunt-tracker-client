import { XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The Account dialog's close button: 34×32, 12px corners, tonal; position it with `className`. */
export const CLOSE_BUTTON_CLASS =
  'grid h-8 w-[34px] shrink-0 cursor-pointer place-items-center rounded-xl bg-beheer-row text-muted-foreground outline-none transition-colors hover:bg-beheer-row-high focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4';

export function CloseButton({ onClick, className, label = 'Sluiten' }: { onClick: () => void; className?: string; label?: string }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={cn(CLOSE_BUTTON_CLASS, className)}>
      <XIcon />
    </button>
  );
}
