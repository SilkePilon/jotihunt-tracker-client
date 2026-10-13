import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** 32px header icon in the marker's shape: a circle (hunters, Life360, picked location) or rounded square (fox markers). */
export function PopupIcon({ shape = 'circle', background, color, children }: { shape?: 'circle' | 'square'; background: string; color: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex size-8 shrink-0 items-center justify-center overflow-hidden text-[13px] font-extrabold [&_svg]:size-[18px]',
        shape === 'circle' ? 'rounded-full' : 'rounded-[10px]',
      )}
      style={{ background, color }}
    >
      {children}
    </div>
  );
}

/** Icon + title + muted subtitle; `stale` greys the icon and turns the subtitle warn-coloured. Leaves room for the close button. */
export default function PopupHeader({ icon, title, subtitle, stale }: { icon: ReactNode; title: ReactNode; subtitle?: ReactNode; stale?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 pr-6">
      <div className={cn('shrink-0', stale && 'opacity-70 grayscale')}>{icon}</div>
      <div className="min-w-0">
        <h2 className="truncate text-[13.5px] leading-tight font-semibold">{title}</h2>
        {subtitle && <p className={cn('truncate text-[11.5px] leading-snug', stale ? 'text-(--map-warn)' : 'text-(--map-muted)')}>{subtitle}</p>}
      </div>
    </div>
  );
}
