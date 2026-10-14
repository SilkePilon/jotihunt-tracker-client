import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/media.hook';
import { REVEAL_TRANSITION } from '@/lib/motion';
import { cn } from '@/lib/utils';

/** One Beheer section: title and one muted line (plus an optional action on the right), then its groups. */
export function BeheerPane({ title, description, action, children }: { title: string; description: ReactNode; action?: ReactNode; children: ReactNode }) {
  // On phones the back-arrow header above the pane already shows the title
  const isMobile = useIsMobile();
  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className={isMobile ? 'sr-only' : 'text-lg font-semibold'}>{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/** A heading and a bordered box of rows, optionally with a muted note below. */
export function BeheerGroup({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="divide-y rounded-lg border">{children}</div>
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
    </section>
  );
}

/**
 * One row of a group box: title, muted meta and one trailing control. Unfolds in and folds away (put rows that come
 * and go inside `<AnimatePresence initial={false}>`); the padding sits on the inner div so the height animates to zero
 * without a jump. `className` goes on that inner row, e.g. for a highlight.
 */
export function BeheerRow({ title, meta, children, className }: { title: ReactNode; meta?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <motion.div
      className="overflow-hidden"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={REVEAL_TRANSITION}
    >
      <div className={cn('flex items-center gap-4 px-4 py-3', className)}>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{title}</div>
          {meta && <div className="text-xs text-muted-foreground">{meta}</div>}
        </div>
        {children}
      </div>
    </motion.div>
  );
}

/** Stands in for a pane's groups while their data loads. */
export function BeheerSkeleton({ groups = 1 }: { groups?: number }) {
  return (
    <div className="flex flex-col gap-7">
      {Array.from({ length: groups }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
