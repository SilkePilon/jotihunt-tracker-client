import type { ReactNode } from 'react';
import { MapIcon } from 'lucide-react';
import { googleMapsUrl } from '@/lib/hunters';
import { cn } from '@/lib/utils';

const BASE =
  'inline-flex h-[30px] min-w-[30px] items-center justify-center gap-1.5 rounded-[9px] px-2 text-xs font-semibold transition-[filter,background-color] hover:brightness-110 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary [&_svg]:size-3.5 [&_svg]:shrink-0';

const VARIANTS = {
  neutral: 'bg-(--map-surface-high) text-(--map-on-surface-variant)',
  primary: 'bg-primary text-primary-foreground',
  danger: 'bg-(--map-danger-bg) text-(--map-danger-fg)',
} as const;

/** Classes of a 30px popup action button. */
export function popupActionClass(variant: keyof typeof VARIANTS, className?: string): string {
  return cn(BASE, VARIANTS[variant], className);
}

/** The bottom row of buttons. */
export function PopupActions({ children }: { children: ReactNode }) {
  return <div className="mt-2.5 flex gap-1.5">{children}</div>;
}

/** Google Maps link: icon-only (30px square) without a label, otherwise full width with the label. */
export function MapsAction({ lat, lng, label }: { lat: number; lng: number; label?: string }) {
  return (
    <a
      target="_blank"
      rel="noreferrer"
      href={googleMapsUrl(lat, lng)}
      aria-label={label ?? 'Bekijk op Google Maps'}
      title={label ? undefined : 'Bekijk op Google Maps'}
      className={popupActionClass('neutral', label ? 'flex-1' : 'w-[30px] px-0')}
    >
      <MapIcon />
      {label}
    </a>
  );
}
