import { useEffect, useReducer, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { CheckIcon, Loader2Icon, RotateCcwIcon, SendIcon } from 'lucide-react';
import { useAdmin } from '@/hooks/admin.hook';
import { useBroadcasts } from '@/hooks/broadcasts.hook';
import { broadcastMeta, SEND_CONFIRM_MS, SEND_DONE_MS, sendButtonLabel, sendTransition, type Broadcast } from '@/lib/beheer';
import { SWAP } from '@/lib/motion';
import { BeheerCard, BeheerPane, BeheerRow, BeheerRows, BeheerSkeleton } from './BeheerLayout';
import { Pill } from './controls/Pill';

/** The server's limit */
const MAX_LENGTH = 200;

/** Beheer → Bericht versturen (B4): push + sound to everyone after a second tap, and what was sent in the last 48 h. */
export default function BroadcastPane() {
  const { broadcasts, error, send } = useBroadcasts(true);
  const { users } = useAdmin();
  const [message, setMessage] = useState('');
  const [state, dispatch] = useReducer(sendTransition, 'idle');
  const textarea = useRef<HTMLTextAreaElement>(null);

  const trimmed = message.trim();
  const view = broadcasts ? 'content' : error ? 'error' : 'loading';

  // "Zeker?" falls back after 3 s, "Verstuurd" after 1.6 s
  useEffect(() => {
    if (state !== 'confirm' && state !== 'sent') return;
    const timeout = setTimeout(() => dispatch(state === 'confirm' ? 'expire' : 'reset'), state === 'confirm' ? SEND_CONFIRM_MS : SEND_DONE_MS);
    return () => clearTimeout(timeout);
  }, [state]);

  async function tap() {
    if (!trimmed || state === 'sending') return;
    dispatch('tap');
    // The first tap only asks
    if (state !== 'confirm') return;
    try {
      await send(trimmed);
      dispatch('success');
      setMessage('');
      toast.success('Bericht verstuurd');
    } catch {
      dispatch('failure');
      toast.error('Versturen is mislukt, probeer het opnieuw.');
    }
  }

  /** "Opnieuw": the old message back in the text field */
  function reuse(broadcast: Broadcast) {
    setMessage(broadcast.body.slice(0, MAX_LENGTH));
    textarea.current?.focus();
  }

  const row = (broadcast: Broadcast) => (
    <BeheerRow key={broadcast.id} title={<span className="min-w-0 font-medium break-words">{broadcast.body}</span>} meta={broadcastMeta(broadcast)}>
      <Pill onClick={() => reuse(broadcast)}>
        <RotateCcwIcon />
        Opnieuw
      </Pill>
    </BeheerRow>
  );

  return (
    <BeheerPane title="Bericht versturen" description="Iedereen krijgt dit als melding met geluid.">
      <BeheerCard title="Nieuw bericht" description="Iedereen krijgt dit als melding met geluid.">
        <textarea
          ref={textarea}
          value={message}
          maxLength={MAX_LENGTH}
          rows={3}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Bijv. Iedereen terug naar HQ"
          aria-label="Bericht"
          disabled={state === 'sending'}
          className="block min-h-[84px] w-full resize-none rounded-2xl bg-beheer-row px-3.5 py-3 text-base outline-none transition-shadow placeholder:text-muted-foreground focus-visible:shadow-[inset_0_0_0_1.5px_var(--primary)] disabled:opacity-60 md:text-sm"
        />
        <div className="mt-2.5 flex items-center gap-3">
          <span className="flex-1 px-1 text-xs text-muted-foreground tabular-nums">
            {message.length} / {MAX_LENGTH}
          </span>
          <Pill
            size="md"
            morphKey={state}
            variant={state === 'confirm' ? 'warn' : state === 'sent' ? 'success' : 'primary'}
            disabled={state === 'sending' || (state !== 'sent' && !trimmed)}
            onClick={() => void tap()}
          >
            {state === 'sending' && <Loader2Icon className="animate-spin" />}
            {state === 'sent' && <CheckIcon />}
            {state === 'idle' && <SendIcon />}
            {sendButtonLabel(state, users?.length)}
          </Pill>
        </div>
      </BeheerCard>

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
            <BeheerCard title="Eerder verstuurd" count={broadcasts?.length}>
              <BeheerRows>
                {broadcasts?.map(row)}
                {broadcasts?.length === 0 && <BeheerRow key="empty" title={<span className="font-normal text-muted-foreground">Nog niets verstuurd in de laatste 48 uur.</span>} />}
              </BeheerRows>
            </BeheerCard>
          </motion.div>
        )}
      </AnimatePresence>
    </BeheerPane>
  );
}
