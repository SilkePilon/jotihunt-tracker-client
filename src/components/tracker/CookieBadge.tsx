import { useMemo } from 'react';
import { BADGE_COOKIE_DEPTH, cookiePath } from '@/lib/cookie-shape';
import { cn } from '@/lib/utils';

interface CookieBadgeProps {
  /** ok = green with a check, warn = amber with an exclamation mark */
  tone: 'ok' | 'warn';
  size: number;
  className?: string;
}

/** Flat Material cookie badge, the same shape as the Android app and the visited pins on the map. */
export default function CookieBadge({ tone, size: s, className }: CookieBadgeProps) {
  const path = useMemo(() => cookiePath(s, BADGE_COOKIE_DEPTH), [s]);
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden className={cn('shrink-0', className)}>
      <path d={path} className={tone === 'ok' ? 'fill-green-500' : 'fill-amber-500'} />
      {tone === 'ok' ? (
        <path
          d={`M${s * 0.31} ${s * 0.51}L${s * 0.44} ${s * 0.64}L${s * 0.69} ${s * 0.38}`}
          fill="none"
          stroke="white"
          strokeWidth={s * 0.09}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <>
          <path d={`M${s / 2} ${s * 0.3}V${s * 0.54}`} stroke="white" strokeWidth={s * 0.09} strokeLinecap="round" />
          <circle cx={s / 2} cy={s * 0.69} r={s * 0.055} fill="white" />
        </>
      )}
    </svg>
  );
}
