import type { ComponentProps, ReactNode } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Tile in a picker grid; picked = orange tonal fill with a primary ring, taken = crossed out. */
export function pickerTileClass(selected: boolean, taken = false): string {
  return cn(
    'flex items-center justify-center gap-1.5 rounded-[14px] text-[13px] font-semibold outline-none transition-[background-color,color,box-shadow] duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/50',
    selected
      ? 'bg-primary-container text-on-primary-container shadow-[inset_0_0_0_2px_var(--primary)]'
      : 'bg-beheer-row hover:bg-beheer-row-high',
    taken && 'cursor-not-allowed line-through opacity-35 hover:bg-beheer-row',
  );
}

interface PickerTriggerProps extends ComponentProps<'button'> {
  /** Area colour dot or icon in front of the value */
  lead: ReactNode;
  placeholder: string;
  /** Chosen value; the muted placeholder shows when empty */
  label?: string;
  invalid?: boolean;
}

/** Card-coloured trigger on the tonal block; the chevron turns and a primary ring shows while its popover is open. */
export function PickerTrigger({ lead, placeholder, label, invalid, className, ...props }: PickerTriggerProps) {
  return (
    <button
      type="button"
      aria-invalid={invalid || undefined}
      className={cn(
        'group flex h-8 w-full min-w-0 items-center gap-1.5 rounded-lg bg-card px-2 text-left text-[13px] outline-none transition-[background-color,box-shadow,opacity] duration-150 hover:bg-beheer-row-high focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-card data-[state=open]:shadow-[inset_0_0_0_2px_var(--primary)] aria-invalid:shadow-[inset_0_0_0_2px_var(--destructive)]',
        className,
      )}
      {...props}
    >
      {lead}
      <span className={cn('min-w-0 flex-1 truncate', !label && 'text-muted-foreground')}>{label ?? placeholder}</span>
      <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
    </button>
  );
}
