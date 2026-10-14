import { motion } from 'motion/react';
import type { SidebarFox } from '@/lib/fox-status';
import { cn } from '@/lib/utils';
import { GROUP_CLASS } from './styles';

const LAYOUT_TRANSITION = { type: 'spring', stiffness: 380, damping: 34 } as const;

/** One segment per fox in group order; segments slide to their new place and fade to the new colour. */
export default function FoxStatusBar({ foxes, size }: { foxes: SidebarFox[]; size: 'full' | 'mini' }) {
  const mini = size === 'mini';
  return (
    <span aria-hidden className={cn('flex', mini ? 'h-2 w-[90px] gap-0.5' : 'h-2.5 w-full gap-[3px]')}>
      {foxes.map((fox) => (
        <motion.span
          key={fox.key}
          layout="position"
          transition={LAYOUT_TRANSITION}
          className={cn(
            'flex-1 rounded-[3px] transition-colors duration-300 first:rounded-l-md last:rounded-r-md motion-reduce:transition-none',
            GROUP_CLASS[fox.group].bar,
          )}
        />
      ))}
    </span>
  );
}
