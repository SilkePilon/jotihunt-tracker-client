import type { ReactNode } from 'react';
import { NavigationIcon } from 'lucide-react';
import { googleRouteUrl } from '@/lib/hunters';
import { cn } from '@/lib/utils';

const BASE =
  'inline-flex h-10 min-w-11 items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold outline-none transition-[filter,background-color,color] duration-200 hover:brightness-105 disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4 [&_svg]:shrink-0';

const VARIANTS = {
  neutral: 'bg-beheer-row-high text-(--map-on-surface)',
  primary: 'bg-primary-container text-on-primary-container',
  danger: 'bg-(--map-danger-bg) text-(--map-danger-fg)',
  success: 'bg-(--map-success-bg) text-(--map-success)',
} as const;

/** Classes of a 40px popup action button. */
export function popupActionClass(variant: keyof typeof VARIANTS, className?: string): string {
  return cn(BASE, VARIANTS[variant], className);
}

/** Add to popupActionClass for a 44px icon-only button. */
export const ICON_ACTION = 'w-11 flex-none px-0';

/** The bottom row of buttons. */
export function PopupActions({ children }: { children: ReactNode }) {
  return <div className="mt-3 flex gap-2">{children}</div>;
}

/**
 * Google Maps directions to the point: the soft-orange "Route" button, or (`compact`, next to Hunt/Spot) a 44px
 * neutral icon button.
 */
export function RouteAction({ lat, lng, compact }: { lat: number; lng: number; compact?: boolean }) {
  return (
    <a
      target="_blank"
      rel="noreferrer"
      href={googleRouteUrl(lat, lng)}
      aria-label="Route in Google Maps"
      title={compact ? 'Route in Google Maps' : undefined}
      className={compact ? popupActionClass('neutral', ICON_ACTION) : popupActionClass('primary', 'min-w-0 flex-1')}
    >
      <NavigationIcon />
      {!compact && 'Route'}
    </a>
  );
}
