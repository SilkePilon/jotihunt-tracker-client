import { useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
}

/** Confirmation dialog (shadcn AlertDialog) that stays open and busy while the confirmed action runs. */
export default function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, cancelLabel = 'Annuleren', destructive, onConfirm, children }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            disabled={busy}
            onClick={(event) => {
              // Keep the dialog open until onConfirm is done
              event.preventDefault();
              void confirm();
            }}
          >
            {busy && <Loader2Icon className="animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
