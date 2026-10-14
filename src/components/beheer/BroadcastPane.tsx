import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { Loader2Icon, SendIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useBroadcasts } from '@/hooks/broadcasts.hook';
import { broadcastMeta, type Broadcast } from '@/lib/beheer';
import { SWAP } from '@/lib/motion';
import { BeheerGroup, BeheerPane, BeheerRow, BeheerSkeleton } from './BeheerLayout';

/** The server's limit */
const MAX_LENGTH = 200;

/** Beheer → Bericht versturen: push + sound to everyone (can't be switched off), and what was sent in the last 48 h. */
export default function BroadcastPane() {
  const { broadcasts, error, send } = useBroadcasts(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const trimmed = message.trim();
  const view = broadcasts ? 'content' : error ? 'error' : 'loading';

  async function submit() {
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await send(trimmed);
      toast.success('Bericht verstuurd');
      setMessage('');
    } catch {
      toast.error('Versturen is mislukt, probeer het opnieuw.');
    } finally {
      setSending(false);
    }
  }

  const row = (broadcast: Broadcast) => (
    <BeheerRow key={broadcast.id} title={<span className="break-words">{broadcast.body}</span>} meta={broadcastMeta(broadcast)} />
  );

  return (
    <BeheerPane title="Bericht versturen" description="Iedereen krijgt dit als melding met geluid.">
      <BeheerGroup title="Nieuw bericht">
        <div className="px-4 py-3">
          <Textarea
            value={message}
            maxLength={MAX_LENGTH}
            rows={3}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Bijv. Iedereen terug naar HQ"
            aria-label="Bericht"
            className="min-h-20 resize-none"
            disabled={sending}
          />
        </div>
        <div className="flex items-center gap-4 px-4 py-3">
          <span className="flex-1 text-xs tabular-nums text-muted-foreground">
            {message.length} / {MAX_LENGTH}
          </span>
          <Button size="sm" onClick={() => void submit()} disabled={sending || !trimmed}>
            {sending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
            Versturen
          </Button>
        </div>
      </BeheerGroup>

      <AnimatePresence mode="wait" initial={false}>
        {view === 'loading' && (
          <motion.div key="loading" {...SWAP}>
            <BeheerSkeleton />
          </motion.div>
        )}
        {view === 'error' && (
          <motion.p key="error" className="text-sm text-muted-foreground" {...SWAP}>
            Kan de verstuurde berichten niet laden.
          </motion.p>
        )}
        {view === 'content' && (
          <motion.div key="content" {...SWAP}>
            <BeheerGroup title="Eerder verstuurd">
              <AnimatePresence initial={false}>
                {broadcasts?.map(row)}
                {broadcasts?.length === 0 && (
                  <BeheerRow key="empty" title={<span className="font-normal text-muted-foreground">Nog niets verstuurd in de laatste 48 uur.</span>} />
                )}
              </AnimatePresence>
            </BeheerGroup>
          </motion.div>
        )}
      </AnimatePresence>
    </BeheerPane>
  );
}
