import { cn } from '@/lib/utils';

/** Progress dots of the website tour: done = primary dot, current = wide primary pill, to come = muted dot. */
export default function StepDots({ count, index, className }: { count: number; index: number; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-[width] duration-200 motion-reduce:transition-none',
            i === index ? 'w-4 bg-primary' : 'w-1.5',
            i < index && 'bg-primary',
            i > index && 'bg-muted-foreground/30',
          )}
        />
      ))}
    </div>
  );
}
