import { useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import Reveal from '@/components/motion/Reveal';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { apiErrorMessage } from '@/lib/api-error';
import { classifyPasskeyError, PASSKEY_MESSAGES } from '@/lib/passkey';
import InlineError from '@/components/InlineError';

interface RenamePasskeyDialogProps {
  open: boolean;
  /** The passkey's current name, the input's starting value */
  name: string;
  onOpenChange: (open: boolean) => void;
  /** Throws on failure; the dialog then shows the error and stays open */
  onSave: (name: string) => Promise<void>;
}

/** A short form to give a passkey a recognisable name ("Telefoon van Silke"). */
export default function RenamePasskeyDialog({ open, name, onOpenChange, onSave }: RenamePasskeyDialogProps) {
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start from the current name each time it opens (state adjusted during render, not in an effect)
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setValue(name);
      setError(null);
    }
  }

  const trimmed = value.trim();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
      onOpenChange(false);
    } catch (failure) {
      setError(apiErrorMessage(failure, PASSKEY_MESSAGES[classifyPasskeyError(failure)]));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Passkey hernoemen</DialogTitle>
            <DialogDescription className="sr-only">Geef deze passkey een naam die je herkent.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Input autoFocus maxLength={40} value={value} onChange={(event) => setValue(event.target.value)} aria-label="Naam" />
            <Reveal gap={8}>
              {error && (
                <InlineError role="alert">
                  {error}
                </InlineError>
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
