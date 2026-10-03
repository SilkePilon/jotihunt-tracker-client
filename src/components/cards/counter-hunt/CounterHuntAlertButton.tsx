import { useState } from 'react';
import { SirenIcon } from 'lucide-react';
import { toast } from 'sonner';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useFetcher } from '@/hooks/utils/api.hook';
import { counterHuntAlertTitle } from '@/lib/counter-hunt';
import type { User } from '@/types/User';
import { SLOW_REQUEST_TIMEOUT_MS } from '@/lib/http';

/** Admins only: alert everyone (push + sound) that there is a tegenhunt in the chosen direction. */
export default function CounterHuntAlertButton({ direction }: { direction: number }) {
  const user = useAuthUser<User>();
  const { fetch } = useFetcher();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const title = counterHuntAlertTitle(direction);
  if (!user?.admin || !title) return null;

  async function send() {
    try {
      await fetch('/admin/counter-hunt', 'POST', { direction }, SLOW_REQUEST_TIMEOUT_MS);
      toast.success('Iedereen is gewaarschuwd', { description: title ?? undefined });
      setConfirmOpen(false);
    } catch {
      // Stay open so it can be sent again
      toast.error('Versturen is mislukt, probeer het opnieuw.');
    }
  }

  return (
    <>
      <Button variant="outline" className="w-full border-red-500/50 text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400" onClick={() => setConfirmOpen(true)}>
        <SirenIcon data-icon="inline-start" />
        Waarschuw iedereen
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Iedereen waarschuwen?"
        description="Iedereen krijgt een melding met geluid:"
        confirmLabel="Versturen"
        onConfirm={send}
      >
        <div className="rounded-md border-2 border-red-500 px-3 py-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <SirenIcon className="size-4 text-red-500" />
            {title}
          </p>
          <p className="text-xs text-muted-foreground">Zoek de sticker binnen 500 m van het clubhuis.</p>
        </div>
      </ConfirmDialog>
    </>
  );
}
