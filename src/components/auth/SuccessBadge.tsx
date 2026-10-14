import { useMemo } from 'react';
import { motion } from 'motion/react';
import { BADGE_COOKIE_DEPTH, cookiePath } from '@/lib/cookie-shape';
import { EASE_OUT, POP_SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';

/** The green cookie check of `CookieBadge tone="ok"`, popping in and then drawing its check. */
export default function SuccessBadge({ size: s, className }: { size: number; className?: string }) {
  const path = useMemo(() => cookiePath(s, BADGE_COOKIE_DEPTH), [s]);
  return (
    <motion.svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      aria-hidden
      className={cn('shrink-0', className)}
      initial={{ scale: 0.4, opacity: 0, rotate: -30 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.15 } }}
      transition={POP_SPRING}
    >
      <path d={path} className="fill-green-500" />
      <motion.path
        d={`M${s * 0.31} ${s * 0.51}L${s * 0.44} ${s * 0.64}L${s * 0.69} ${s * 0.38}`}
        fill="none"
        stroke="white"
        strokeWidth={s * 0.09}
        strokeLinecap="round"
        strokeLinejoin="round"
        // Hidden until it starts drawing: a zero-length path with round caps still shows a dot
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.15, ease: EASE_OUT, opacity: { duration: 0.01, delay: 0.15 } }}
      />
    </motion.svg>
  );
}
