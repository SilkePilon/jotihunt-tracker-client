import type { ReactNode } from 'react';
import { NavigationIcon } from 'lucide-react';
import { googleRouteUrl } from '@/lib/hunters';
import { cn } from '@/lib/utils';
import { TONAL_HOVER } from '@/lib/tonal-button';

const BASE =
  'inline-flex h-10 min-w-11 pointer-coarse:h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-body font-semibold outline-none transition-[background-color,color] duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-[3px] focus-visible:ring-ring [&_svg]:size-4 [&_svg]:shrink-0';

/** Hover per fill: the tonal step on grey, 10% of the on-colour into the coloured fills (like Button's default). */
const VARIANTS = {
  neutral: `bg-beheer-row-high text-(--map-on-surface) ${TONAL_HOVER}`,
  primary:
    'bg-primary-container text-on-primary-container hover:bg-[color-mix(in_oklab,var(--on-primary-container)_10%,var(--primary-container))]',
  danger: 'bg-(--map-danger-bg) text-(--map-danger-fg) hover:bg-[color-mix(in_oklab,var(--map-danger-fg)_10%,var(--map-danger-bg))]',
  success: 'bg-(--map-success-bg) text-(--map-success) hover:bg-[color-mix(in_oklab,var(--map-success)_10%,var(--map-success-bg))]',
} as const;

/** Classes of a 40px popup action button (44px on touch screens). */
export function popupActionClass(variant: keyof typeof VARIANTS, className?: string): string {
  return cn(BASE, VARIANTS[variant], className);
}

/** Add to popupActionClass for a 44px icon-only button. */
export const ICON_ACTION = 'w-11 flex-none px-0';

/** The bottom row of buttons; `className` e.g. for a second row closer to the first. */
export function PopupActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mt-3 flex gap-2', className)}>{children}</div>;
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
      aria-label="Route in Google Maps (opent in nieuw tabblad)"
      title={compact ? 'Route in Google Maps' : undefined}
      className={compact ? popupActionClass('neutral', ICON_ACTION) : popupActionClass('primary', 'min-w-0 flex-1')}
    >
      <NavigationIcon />
      {!compact && 'Route'}
    </a>
  );
}
