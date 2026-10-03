import { useState } from 'react';
import { SirenIcon } from 'lucide-react';
import { toast } from 'sonner';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { Button } from '@/components/ui/button';
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
import { useFetcher } from '@/hooks/utils/api.hook';
import { counterHuntAlertTitle } from '@/lib/counter-hunt';
import type { User } from '@/types/User';

/** Admins only: alert everyone (push + sound) that there is a tegenhunt in the chosen direction. */
export default function CounterHuntAlertButton({ direction }: { direction: number }) {
  const user = useAuthUser<User>();
  const { fetch } = useFetcher();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const title = counterHuntAlertTitle(direction);
  if (!user?.admin || !title) return null;

  async function send() {
    setSending(true);
    try {
      await fetch('/admin/counter-hunt', 'POST', { direction });
      toast.success('Iedereen is gewaarschuwd', { description: title ?? undefined });
      setConfirmOpen(false);
    } catch {
      toast.error('Versturen is mislukt, probeer het opnieuw.');
    } finally {
      setSending(false);
    }
  }

  return (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <Button variant="outline" className="w-full border-red-500/50 text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400" onClick={() => setConfirmOpen(true)}>
        <SirenIcon data-icon="inline-start" />
        Waarschuw iedereen
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Iedereen waarschuwen?</AlertDialogTitle>
          <AlertDialogDescription>Iedereen krijgt een melding met geluid:</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-md border-2 border-red-500 px-3 py-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <SirenIcon className="size-4 text-red-500" />
            {title}
          </p>
          <p className="text-xs text-muted-foreground">Zoek de sticker binnen 500 m van het clubhuis.</p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={sending}>Annuleren</AlertDialogCancel>
          <AlertDialogAction
            disabled={sending}
            onClick={(event) => {
              // Keep the dialog open until the request is done
              event.preventDefault();
              void send();
            }}
          >
            Versturen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
