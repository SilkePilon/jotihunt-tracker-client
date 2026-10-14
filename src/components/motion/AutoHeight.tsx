import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { SWAP_TRANSITION } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface AutoHeightProps {
  children: ReactNode;
  /** Wrapper (clips while it grows or shrinks) */
  className?: string;
  /** Measured content box; give it padding plus a matching negative margin on the wrapper to keep focus rings and shadows unclipped */
  innerClassName?: string;
}

/** Follows the height of its content smoothly, so a container grows/shrinks between states instead of jumping. */
export default function AutoHeight({ children, className, innerClassName }: AutoHeightProps) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>('auto');

  useLayoutEffect(() => {
    const element = inner.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div className={cn('overflow-hidden', className)} initial={false} animate={{ height }} transition={SWAP_TRANSITION}>
      <div ref={inner} className={innerClassName}>
        {children}
      </div>
    </motion.div>
  );
}
