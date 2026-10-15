import type { ComponentProps, ReactNode } from 'react';
import { DropdownMenuItem, DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/** The settings menu and its phone submenus: a rounded-3xl card like the map layers popover. */
export const MENU_CARD = 'rounded-3xl border-0 bg-card p-3 text-card-foreground shadow-[0_0_0_1px_var(--border),0_10px_30px_rgb(0_0_0/0.28)]';

/** A Beheer row: tonal block, 6px corners, 16px on the outer ends of its group (see MenuRows). */
export const MENU_ROW =
  'gap-2.5 rounded-md bg-beheer-row px-3 py-2.5 text-[13.5px] font-semibold transition-colors duration-150 first:rounded-t-2xl last:rounded-b-2xl focus:bg-beheer-row-high';

/** Groups rows with 2px seams. Conditional rows render nothing, so first/last corners stay right. */
export function MenuRows({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex flex-col gap-0.5', className)}>{children}</div>;
}

export function MenuRow({ className, ...props }: ComponentProps<typeof DropdownMenuItem>) {
  return <DropdownMenuItem className={cn(MENU_ROW, className)} {...props} />;
}

/** Row that opens a submenu (phones: Zichtbare lagen, Kaartstijl); stays highlighted while its submenu is open. */
export function MenuSubRow({ className, ...props }: ComponentProps<typeof DropdownMenuSubTrigger>) {
  return <DropdownMenuSubTrigger className={cn(MENU_ROW, 'data-[state=open]:bg-beheer-row-high', className)} {...props} />;
}

/** Quick tile: icon above a short label. Give the icon `size-5` itself. */
export function MenuTile({ className, ...props }: ComponentProps<typeof DropdownMenuItem>) {
  return (
    <DropdownMenuItem
      className={cn('flex-col justify-center gap-1.5 rounded-2xl bg-beheer-row px-1 pt-3 pb-2.5 text-[11.5px] font-semibold transition-colors duration-200 focus:bg-beheer-row-high', className)}
      {...props}
    />
  );
}
