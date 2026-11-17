import type { ComponentProps, ReactNode } from 'react';
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import BeheerSwitch from '@/components/beheer/controls/BeheerSwitch';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { MENU_GROUP, MENU_ROW_BASE, MENU_ROW_DISABLED, MENU_SURFACE } from '@/lib/menu-styles';
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

/**
 * A row that turns a setting on or off: a menuitemcheckbox (screen readers hear "aangevinkt") with the M3 switch at its
 * end. The switch is only the look (hidden, not focusable, not clickable); the row is the control.
 */
export function MenuSwitchRow({ className, checked, children, ...props }: ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem className={cn(MENU_ROW_BASE, MENU_ROW_DISABLED, className)} checked={checked} {...props}>
      {children}
      <BeheerSwitch checked={checked === true} tabIndex={-1} aria-hidden className="pointer-events-none ml-auto" />
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

/** Quick tile shape: icon above a short label */
const TILE = 'flex-col justify-center gap-1.5 rounded-2xl px-1 pt-3 pb-2.5 text-xs desk:text-label first:rounded-2xl last:rounded-2xl duration-200';

/** Quick tile: icon above a short label. Give the icon `size-5` itself. */
export function MenuTile({ className, ...props }: ComponentProps<typeof DropdownMenuItem>) {
  return <DropdownMenuItem className={cn(TILE, className)} {...props} />;
}

/** Quick tile for an on/off setting (menuitemcheckbox); the caller styles the on state. */
export function MenuCheckboxTile({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return <DropdownMenuPrimitive.CheckboxItem className={cn(MENU_ROW_BASE, MENU_ROW_DISABLED, TILE, className)} {...props} />;
}
