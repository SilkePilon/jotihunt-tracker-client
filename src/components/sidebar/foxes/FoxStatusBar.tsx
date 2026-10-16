import { AnimatePresence, motion } from 'motion/react';
import type { CSSProperties } from 'react';
import type { SidebarFox } from '@/lib/fox-status';
import { LAYOUT_SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { GROUP_CLASS } from './styles';

/** Diagonal stripes in the card colour over a forbidden fox's segment (light and dark theme). */
const HATCH: CSSProperties = { backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 2px, color-mix(in oklab, var(--card) 65%, transparent) 2px 3.5px)' };

/**
 * One segment per fox in group order; segments slide to their new place and fade to the new colour. A fox we may not
 * hunt is dimmed and hatched (the hatch fades in/out).
 */
export default function FoxStatusBar({ foxes, size, isForbidden }: { foxes: SidebarFox[]; size: 'full' | 'mini'; isForbidden: (area: string) => boolean }) {
  const mini = size === 'mini';
  return (
    <span aria-hidden className={cn('flex', mini ? 'h-2 w-[90px] gap-0.5' : 'h-2.5 w-full gap-[3px]')}>
      {foxes.map((fox) => {
        const forbidden = isForbidden(fox.area.name);
        return (
          <motion.span
            key={fox.key}
            layout="position"
            transition={LAYOUT_SPRING}
            className={cn(
              'relative flex-1 overflow-hidden rounded-[3px] transition-[background-color,opacity] duration-300 first:rounded-l-md last:rounded-r-md motion-reduce:transition-none',
              GROUP_CLASS[fox.group].bar,
              forbidden && 'opacity-45',
            )}
          >
            <AnimatePresence initial={false}>
              {forbidden && (
                <motion.span key="hatch" className="absolute inset-0" style={HATCH} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} />
              )}
            </AnimatePresence>
          </motion.span>
        );
      })}
    </span>
  );
}
