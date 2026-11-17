/**
 * Desktop dialog shell (Account, Meldingen, Intel): 28px card without border, the layers-popover shadow, and the built-in
 * close X as a 34×32 tonal button with 12px corners like the sidebar header buttons. Add width, background and padding.
 */
export const DIALOG_SHELL =
  'rounded-[28px] border-0 shadow-[0_0_0_1px_var(--border),0_18px_50px_rgb(0_0_0/0.35)] [&>[data-slot=dialog-close]]:top-4 [&>[data-slot=dialog-close]]:right-4 [&>[data-slot=dialog-close]]:grid [&>[data-slot=dialog-close]]:h-8 [&>[data-slot=dialog-close]]:w-[34px] [&>[data-slot=dialog-close]]:place-items-center [&>[data-slot=dialog-close]]:rounded-xl [&>[data-slot=dialog-close]]:bg-beheer-row [&>[data-slot=dialog-close]]:text-muted-foreground [&>[data-slot=dialog-close]]:opacity-100 [&>[data-slot=dialog-close]]:ring-0 [&>[data-slot=dialog-close]]:ring-offset-0 [&>[data-slot=dialog-close]]:transition-colors [&>[data-slot=dialog-close]:hover]:bg-beheer-row-high [&>[data-slot=dialog-close]:focus-visible]:ring-[3px] [&>[data-slot=dialog-close]:focus-visible]:ring-ring';

/**
 * Small-dialog footer buttons (ConfirmDialog, passkey rename, marker form): 40px tall, 12px corners, no shadow. Put it on
 * the primary Button (variant default/destructive). It keeps the stock variant prefixes, so cn replaces them.
 */
export const DIALOG_ACTION = 'h-10 rounded-xl px-[18px] font-semibold shadow-none';

/** The secondary (Annuleren) action: a tonal row-high button; put it on a Button with variant="outline" */
export const DIALOG_ACTION_CANCEL = `${DIALOG_ACTION} border-0 bg-beheer-row-high text-foreground hover:bg-[color-mix(in_oklab,var(--foreground)_14%,var(--card))] hover:text-foreground dark:bg-beheer-row-high dark:hover:bg-[color-mix(in_oklab,var(--foreground)_14%,var(--card))]`;
