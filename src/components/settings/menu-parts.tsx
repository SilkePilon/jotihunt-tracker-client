import type { ComponentProps, ReactNode } from 'react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { MENU_GROUP, MENU_SURFACE } from '@/lib/menu-styles';
import { cn } from '@/lib/utils';

/** The menu card (now the default of every dropdown); kept for popovers that show a menu-like card. */
export const MENU_CARD = `${MENU_SURFACE} p-3`;

/** Groups rows with 2px seams. Conditional rows render nothing, so first/last corners stay right. */
export function MenuRows({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn(MENU_GROUP, className)}>{children}</div>;
}

export function MenuRow(props: ComponentProps<typeof DropdownMenuItem>) {
  return <DropdownMenuItem {...props} />;
}

/** Quick tile: icon above a short label. Give the icon `size-5` itself. */
export function MenuTile({ className, ...props }: ComponentProps<typeof DropdownMenuItem>) {
  return (
    <DropdownMenuItem
      className={cn('flex-col justify-center gap-1.5 rounded-2xl px-1 pt-3 pb-2.5 text-[11.5px] first:rounded-2xl last:rounded-2xl duration-200', className)}
      {...props}
    />
  );
}
