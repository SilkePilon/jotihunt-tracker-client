import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * 36px header icon in the marker's shape: a circle (hunters, Life360, picked location) or rounded square (fox markers,
 * groups, fastfood); `rim` adds the marker's white rim (fastfood tiles).
 */
export function PopupIcon({ shape = 'circle', background, color, rim, children }: { shape?: 'circle' | 'square'; background: string; color: string; rim?: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex size-9 shrink-0 items-center justify-center overflow-hidden text-[15px] font-extrabold [&_svg]:size-[19px]',
        shape === 'circle' ? 'rounded-full' : 'rounded-[11px]',
        rim && 'border-2 border-white shadow-[0_0_0_1px_var(--map-hairline),0_1px_3px_rgb(0_0_0/0.2)]',
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
    <div className="flex items-center gap-2.5 pr-10">
      <div className={cn('shrink-0 transition-[filter,opacity] duration-200', stale && 'opacity-70 grayscale')}>{icon}</div>
      <div className="min-w-0">
        <h2 className="truncate text-[15px] leading-tight font-bold">{title}</h2>
        {subtitle && <p className={cn('truncate text-xs leading-snug transition-colors duration-200', stale ? 'text-(--map-warn)' : 'text-(--map-muted)')}>{subtitle}</p>}
      </div>
    </div>
  );
}
