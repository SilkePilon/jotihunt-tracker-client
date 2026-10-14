import type { ComponentType, ReactNode } from 'react';
import { motion } from 'motion/react';
import { SWAP_TRANSITION } from '@/lib/motion';
import { cn } from '@/lib/utils';

export type NavIcon = ComponentType<{ className?: string }>;

interface NavItemProps {
  icon?: NavIcon;
  /** Instead of an icon, e.g. an area dot; give it the icon's 18px box so titles line up */
  leading?: ReactNode;
  title: string;
  active?: boolean;
  trailing?: ReactNode;
  /** layoutId of the soft fill behind the active item, so it slides to a newly picked item */
  indicatorId?: string;
  onClick: () => void;
  className?: string;
}

/** N1 item of a window's nav: icon + name, 40px, rounded-xl; active = soft grey fill + semibold (no pill, no orange). */
export function NavItem({ icon: ItemIcon, leading, title, active, trailing, indicatorId, onClick, className }: NavItemProps) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'relative flex h-10 items-center rounded-xl px-3 text-left text-[13.5px] outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
        active ? 'font-semibold text-foreground' : 'text-muted-foreground hover:bg-beheer-row-high/50 hover:text-foreground active:bg-beheer-row-high',
        className,
      )}
    >
      {active && indicatorId && <motion.span layoutId={indicatorId} aria-hidden className="absolute inset-0 rounded-xl bg-beheer-row-high" transition={SWAP_TRANSITION} />}
      <span className="relative flex min-w-0 flex-1 items-center gap-3">
        {ItemIcon ? <ItemIcon className="size-[18px] shrink-0" /> : leading}
        <span className="truncate">{title}</span>
        {trailing}
      </span>
    </button>
  );
}
