import { useState } from 'react';
import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import BusyIcon from '@/components/motion/BusyIcon';
import { DIALOG_ACTION, DIALOG_ACTION_CANCEL } from '@/lib/dialog-shell';
import { cn } from '@/lib/utils';

// Option A: same shell as DIALOG_SHELL (28px, window surface), tonal 12px buttons, pop-in with a slight overshoot.
// Overrides keep the stock variant prefixes, because cn only replaces classes with the same prefix. The buttons are
// Radix Cancel/Action around our own Button (not the shadcn wrappers): Slot concatenates classes without cn, so the
// wrappers' outline/destructive dark classes would beat these.
const CONTENT =
  'gap-0 rounded-[28px] border-0 bg-beheer-window p-6 shadow-[0_0_0_1px_var(--border),0_18px_50px_rgb(0_0_0/0.35)] data-[size=default]:sm:max-w-[400px] data-[state=open]:duration-[320ms] data-[state=open]:ease-[cubic-bezier(0.2,0.9,0.3,1.2)] data-[state=open]:zoom-in-[0.92] data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:duration-150 data-[state=closed]:ease-[cubic-bezier(0.3,0,0.8,0.15)] data-[state=closed]:zoom-out-[0.92] data-[state=closed]:slide-out-to-bottom-2 motion-reduce:animate-none';
const HEADER = 'place-items-start gap-1.5 text-left';
/** Looks like disabled (aria-disabled keeps the focus) */
const BUSY = 'aria-disabled:pointer-events-none aria-disabled:opacity-50';
/** Phones: 44px tall touch targets */
const COARSE = 'pointer-coarse:h-11';
const DESTRUCTIVE = 'dark:bg-[color-mix(in_oklab,var(--destructive)_75%,black)] dark:hover:bg-[color-mix(in_oklab,var(--destructive)_65%,black)]';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description: React.ReactNode;
  confirmLabel: React.ReactNode;
  cancelLabel?: React.ReactNode;
  destructive?: boolean;
  /**
   * Runs when the confirm button is clicked. The dialog stays open with disabled buttons (and can't be dismissed)
   * until it settles; closing afterwards is up to the caller (call `onOpenChange(false)`), so it can stay open on
   * errors. Errors are swallowed here: handle (toast) them inside onConfirm.
   */
  onConfirm: () => Promise<unknown> | unknown;
  /** Extra content between the description and the buttons */
  children?: React.ReactNode;
  /**
   * Where focus goes after closing (Radix returns it to the opener by default): preventDefault and focus something
   * else when the opener went away with the confirmed action (e.g. the row of a removed session).
   */
  onCloseAutoFocus?: (event: Event) => void;
}

/** Confirmation dialog (shadcn AlertDialog) that stays open and busy while the confirmed action runs. */
export default function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, cancelLabel = 'Annuleren', destructive, onConfirm, children, onCloseAutoFocus }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } catch {
      // The caller shows its own error
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <AlertDialogContent className={CONTENT} onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader className={HEADER}>
          <AlertDialogTitle className="text-lg font-bold tracking-tight">{title}</AlertDialogTitle>
          <AlertDialogDescription className="leading-relaxed">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children && <div className="mt-4">{children}</div>}
        <AlertDialogFooter className="mt-6 flex-row justify-end">
          <AlertDialogPrimitive.Cancel asChild>
            {/* aria-disabled, not disabled, while busy: disabling the focused button would drop the focus out of the dialog.
                Clicks are ignored: onOpenChange above refuses to close while busy. */}
            <Button variant="outline" className={cn(DIALOG_ACTION_CANCEL, COARSE, BUSY)} aria-disabled={busy || undefined}>
              {cancelLabel}
            </Button>
          </AlertDialogPrimitive.Cancel>
          <AlertDialogPrimitive.Action asChild>
            <Button
              variant={destructive ? 'destructive' : 'default'}
              className={cn(DIALOG_ACTION, COARSE, destructive && DESTRUCTIVE, BUSY)}
              aria-disabled={busy || undefined}
              aria-busy={busy || undefined}
              onClick={(event) => {
                // Keep the dialog open until onConfirm is done
                event.preventDefault();
                void confirm();
              }}
            >
              {/* The spinner takes the label's place (which keeps its width): the button doesn't change size or shift */}
              <span className="relative inline-flex items-center justify-center">
                <span className={cn('transition-opacity duration-150 motion-reduce:transition-none', busy && 'opacity-0')}>{confirmLabel}</span>
                <span className="absolute inset-0 flex items-center justify-center">
                  <BusyIcon busy={busy} />
                </span>
              </span>
            </Button>
          </AlertDialogPrimitive.Action>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
