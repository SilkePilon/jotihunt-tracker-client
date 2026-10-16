import { motion } from 'motion/react';
import CountUp from '@/components/motion/CountUp';
import { LAYOUT_SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { HuntSyncStatus } from '@/types/HuntSync';

const BAR_WIDTH = 150;
const GAP = 3;

const SEGMENTS = [
  { key: 'approved', label: 'goedgekeurd', fill: 'bg-green-500' },
  { key: 'pending', label: 'wacht', fill: 'bg-amber-500' },
  { key: 'rejected', label: 'afgekeurd', fill: 'bg-red-500' },
] as const;

/**
 * Result bar (mockup C v3): 150 × 10 px, approved / waiting / rejected with 3 px gaps, counts next to it. Segments grow
 * and shrink to their new widths; with no hunts yet the bar is an empty grey track.
 */
export default function HuntResultBar({ counts }: { counts: HuntSyncStatus['counts'] }) {
  const values = SEGMENTS.map((segment) => counts[segment.key]);
  const sum = values.reduce((total, value) => total + value, 0);
  const visible = values.filter((value) => value > 0).length;
  const room = BAR_WIDTH - GAP * Math.max(0, visible - 1);

  return (
    <div className="mt-2.5 flex items-center justify-center gap-2" aria-label={SEGMENTS.map((segment, index) => `${values[index]} ${segment.label}`).join(', ')}>
      <div className={cn('flex h-2.5 overflow-hidden rounded-[5px] transition-colors', sum === 0 && 'bg-secondary')} style={{ width: BAR_WIDTH }}>
        {SEGMENTS.map((segment, index) => {
          const value = values[index];
          const gapBefore = value > 0 && values.slice(0, index).some((previous) => previous > 0) ? GAP : 0;
          return (
            <motion.i
              key={segment.key}
              className={cn('block h-full shrink-0 rounded-[5px]', segment.fill)}
              initial={false}
              animate={{ width: sum === 0 ? 0 : (value / sum) * room, marginLeft: gapBefore }}
              transition={LAYOUT_SPRING}
            />
          );
        })}
      </div>
      <div className="inline-flex gap-2 text-[11.5px] font-semibold tabular-nums" aria-hidden>
        {SEGMENTS.map((segment, index) => (
          <span key={segment.key} className="inline-flex items-center gap-[3px]">
            <span className={cn('size-[7px] rounded-[2px]', segment.fill)} />
            <CountUp value={values[index]} />
          </span>
        ))}
      </div>
    </div>
  );
}
