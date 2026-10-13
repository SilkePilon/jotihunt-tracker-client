import { ReactNode, useMemo } from 'react';
import { BADGE_COOKIE_DEPTH, cookiePath } from '@/lib/cookie-shape';
import { TEGENHUNT_RED } from '@/lib/bot-messages';
import { cn } from '@/lib/utils';

export type CookieTone = 'ok' | 'warn' | 'danger' | 'neutral';

interface CookieBadgeProps {
  /** ok = green with a check, warn = amber with an exclamation mark, danger = solid red, neutral = muted grey */
  tone: CookieTone;
  size: number;
  /** Replaces the tone's check / exclamation mark: text (drawn bold, centred) or an element (centred, e.g. an icon) */
  glyph?: ReactNode;
  className?: string;
}

const FILL: Record<CookieTone, string> = {
  ok: 'fill-green-500',
  warn: 'fill-amber-500',
  danger: '',
  neutral: 'fill-zinc-200 dark:fill-zinc-700',
};

/** Flat Material cookie badge, the same shape as the Android app and the visited pins on the map. */
export default function CookieBadge({ tone, size: s, glyph, className }: CookieBadgeProps) {
  const path = useMemo(() => cookiePath(s, BADGE_COOKIE_DEPTH), [s]);
  const glyphClass = tone === 'neutral' ? 'text-zinc-500 dark:text-zinc-400' : 'text-white';
  const shape = <path d={path} className={FILL[tone]} fill={tone === 'danger' ? TEGENHUNT_RED : undefined} />;

  if (glyph !== undefined && typeof glyph !== 'string') {
    return (
      <span className={cn('relative inline-grid shrink-0 place-items-center', glyphClass, className)} style={{ width: s, height: s }}>
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden className="absolute inset-0">
          {shape}
        </svg>
        <span className="relative grid place-items-center">{glyph}</span>
      </span>
    );
  }

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden className={cn('shrink-0', glyphClass, className)}>
      {shape}
      {typeof glyph === 'string' ? (
        <text x={s / 2} y={s / 2} dy="0.35em" textAnchor="middle" fontSize={s * 0.42} fontWeight={700} fill="currentColor">
          {glyph}
        </text>
      ) : tone === 'ok' ? (
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
          <path d={`M${s / 2} ${s * 0.3}V${s * 0.54}`} stroke="currentColor" strokeWidth={s * 0.09} strokeLinecap="round" />
          <circle cx={s / 2} cy={s * 0.69} r={s * 0.055} fill="currentColor" />
        </>
      )}
    </svg>
  );
}
