import { CheckIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { POP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { NotificationIcon } from './notification-icons';

interface NotificationTileProps {
  icon: NotificationIcon;
  label: string;
  short: string;
  /** Full explanation: tooltip and screen-reader text */
  description: string;
  on: boolean;
  onToggle: () => void;
  /** Saving or read-only: shows the state but can not be toggled */
  disabled?: boolean;
}

/** Toggle tile in the Meldingen dialog: light orange with a check badge when on, tonal grey when off. */
export default function NotificationTile({ icon: Icon, label, short, description, on, onToggle, disabled }: NotificationTileProps) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={description}
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'relative flex min-h-[104px] cursor-pointer flex-col items-start gap-2 rounded-2xl p-3 text-left outline-none transition-[background-color,color,filter,opacity] duration-200 focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none',
        on ? 'bg-(--map-selected-bg) text-(--map-selected-fg) enabled:hover:brightness-[.97]' : 'bg-beheer-row text-muted-foreground enabled:hover:bg-beheer-row-high',
      )}
    >
      <Icon className="size-5" aria-hidden />
      <AnimatePresence initial={false}>
        {on && (
          <motion.span key="check" {...POP} aria-hidden className="absolute top-2.5 right-2.5 grid size-5 place-items-center rounded-full bg-primary-text text-primary-foreground dark:bg-primary">
            <CheckIcon className="size-3" strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
      <span className={cn('text-[13px] font-semibold transition-colors duration-200 motion-reduce:transition-none', !on && 'text-foreground')}>{label}</span>
      <span className="-mt-1 text-xs leading-snug md:text-[11px]">{short}</span>
      <span className="sr-only">{description}</span>
    </button>
  );
}
