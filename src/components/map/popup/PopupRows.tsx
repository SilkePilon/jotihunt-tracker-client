import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type RowTone = 'default' | 'success' | 'warn' | 'danger';

// Tone: row background, then the colour of the icon, title and meta
const TONE: Record<RowTone, string> = {
  default: 'bg-beheer-row',
  success: 'bg-(--map-success-bg) text-(--map-success)',
  warn: 'bg-(--map-warn-bg) text-(--map-warn)',
  danger: 'bg-(--map-danger-bg) text-(--map-danger-fg)',
};

/** Grouped rows like the Beheer/Meldingen dialogs: 2px gaps, 16px outer corners. */
export function PopupRows({ children }: { children: ReactNode }) {
  return <div className="mt-3 flex flex-col gap-0.5 [&>*]:rounded-(--radius-segment) [&>*:first-child]:rounded-t-2xl [&>*:last-child]:rounded-b-2xl">{children}</div>;
}

/**
 * Two rows side by side (one fills the width); the group's outer corners clip them.
 * Must be a direct child of `PopupRows`, which gives it the rounded corners its `overflow-hidden` clips to.
 */
export function PopupRowSplit({ children }: { children: ReactNode }) {
  return <div className="grid auto-cols-fr grid-flow-col gap-0.5 overflow-hidden">{children}</div>;
}

/**
 * One row: optional icon, optional uppercase label, title, optional meta line, optional trailing buttons.
 * A tone colours the icon, title and meta; the `label` stays muted on toned rows too.
 */
export function PopupRow({ icon, label, title, meta, trailing, tone = 'default' }: { icon?: ReactNode; label?: string; title: ReactNode; meta?: ReactNode; trailing?: ReactNode; tone?: RowTone }) {
  const toned = tone !== 'default';
  return (
    <div className={cn('flex min-h-10 min-w-0 items-center gap-2.5 rounded-(--radius-segment) px-3 py-2 transition-colors duration-200', TONE[tone])}>
      {icon && <span className={cn('grid shrink-0 place-items-center [&_svg]:size-4', !toned && 'text-(--map-muted)')}>{icon}</span>}
      <div className="min-w-0 flex-1">
        {/* Label and meta: at least 12px on phones, the compact sizes from md */}
        {label && <div className="text-xs tracking-wide md:text-[10px] text-(--map-muted) uppercase">{label}</div>}
        <div className="truncate text-[13px] font-semibold tabular-nums">{title}</div>
        {/* Full tone colour in light mode: at 80% the meta drops under 4.5:1 on the tinted rows */}
        {meta && <div className={cn('truncate text-xs tabular-nums md:text-[11.5px]', toned ? 'dark:opacity-80' : 'text-(--map-muted)')}>{meta}</div>}
      </div>
      {trailing && <div className="-mr-1.5 flex shrink-0 items-center gap-1 text-(--map-on-surface-variant)">{trailing}</div>}
    </div>
  );
}
