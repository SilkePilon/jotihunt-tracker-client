import { useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import Reveal from '@/components/motion/Reveal';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { apiErrorMessage } from '@/lib/api-error';
import type { UserChanges } from '@/hooks/admin.hook';
import type { User } from '@/types/User';

interface RenameUserDialogProps {
  open: boolean;
  /** The user to rename; kept by the caller while the dialog fades out */
  user: User | null;
  onOpenChange: (open: boolean) => void;
  /** `useAdmin().updateUser`: resolves to null on success, else to the error */
  updateUser: (id: string, changes: UserChanges) => Promise<unknown>;
}

/** Beheer → Gebruikers → ⋯ → Naam wijzigen. */
export default function RenameUserDialog({ open, user, onOpenChange, updateUser }: RenameUserDialogProps) {
  const [value, setValue] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start from the current name each time it opens (state adjusted during render, not in an effect)
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setValue(user?.name ?? '');
      setError(null);
    }
  }

  const trimmed = value.trim();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !trimmed || saving) return;
    setSaving(true);
    setError(null);
    const failure = await updateUser(user._id, { name: trimmed });
    setSaving(false);
    if (failure) {
      setError(apiErrorMessage(failure, 'De naam kon niet worden opgeslagen.'));
      return;
    }
    onOpenChange(false);
    toast.success('Naam opgeslagen');
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Naam wijzigen</DialogTitle>
            <DialogDescription className="sr-only">De naam die iedereen in de app ziet.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Input autoFocus maxLength={40} value={value} onChange={(event) => setValue(event.target.value)} aria-label="Naam" autoComplete="off" data-1p-ignore />
            <Reveal gap={8}>
              {error && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {error}
                </p>
              )}
            </Reveal>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Annuleren
            </Button>
            <Button type="submit" disabled={saving || !trimmed}>
              {saving && <Loader2Icon className="animate-spin" />}
              Opslaan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
