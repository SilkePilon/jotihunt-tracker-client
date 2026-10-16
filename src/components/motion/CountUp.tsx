import { useEffect } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { cn } from '@/lib/utils';

/** A whole number that rolls to its value: from `from` on mount (a count-up), then from the old value on every change */
export default function CountUp({ value, from = value, className }: { value: number; from?: number; className?: string }) {
  const reduce = useReducedMotion();
  const current = useMotionValue(from);
  const text = useTransform(current, (latest) => String(Math.round(latest)));
  useEffect(() => {
    if (reduce) {
      current.set(value);
      return;
    }
    const controls = animate(current, value, { duration: 0.7, ease: [0.33, 1, 0.68, 1] });
    return () => controls.stop();
  }, [value, reduce, current]);
  return <motion.span className={cn('tabular-nums', className)}>{text}</motion.span>;
}
