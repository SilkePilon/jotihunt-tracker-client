import { useState } from 'react';
import { toast } from 'sonner';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import { useFetcher } from '@/hooks/utils/api.hook';
import useAdminStore from '@/stores/admin.store';
import type { User } from '@/types/User';
import { SLOW_REQUEST_TIMEOUT_MS } from '@/lib/http';

const MAX_LENGTH = 200;

/** Settings → Admin tools → Bericht versturen: push + sound to everyone (can't be switched off). */
export default function BroadcastDialog() {
  const user = useAuthUser<User>();
  const open = useAdminStore((state) => state.dialog === 'broadcast');
  const close = useAdminStore((state) => state.close);
  const { fetch } = useFetcher();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  if (!user?.admin) return null;

  async function send() {
    setSending(true);
    try {
      await fetch('/admin/broadcast', 'POST', { message: message.trim() }, SLOW_REQUEST_TIMEOUT_MS);
      toast.success('Bericht verstuurd');
      setMessage('');
      close();
    } catch {
      toast.error('Versturen is mislukt, probeer het opnieuw.');
    } finally {
      setSending(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onClose={close} title="Bericht versturen" description="Iedereen krijgt dit als melding met geluid." className="sm:max-w-sm" compact>
      <div className="flex flex-col gap-2">
        <Textarea value={message} maxLength={MAX_LENGTH} onChange={(event) => setMessage(event.target.value)} placeholder="Bijv. Iedereen terug naar HQ" rows={2} className="min-h-0 resize-none" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {message.length}/{MAX_LENGTH}
          </span>
          <Button size="sm" onClick={() => void send()} disabled={sending || message.trim().length === 0}>
            Versturen
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
