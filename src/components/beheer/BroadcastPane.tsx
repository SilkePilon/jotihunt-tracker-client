import { useEffect, useReducer, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { CheckIcon, Loader2Icon, RotateCcwIcon, SendIcon } from 'lucide-react';
import { useAdmin } from '@/hooks/admin.hook';
import { useBroadcasts } from '@/hooks/broadcasts.hook';
import { broadcastMeta, SEND_CONFIRM_MS, SEND_DONE_MS, sendButtonLabel, sendConfirmAnnouncement, sendTransition, type Broadcast } from '@/lib/beheer';
import { SWAP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { BeheerCard, BeheerLoadError, BeheerPane, BeheerRow, BeheerRows, BeheerSkeleton } from './BeheerLayout';
import { Pill } from './controls/Pill';

/** The server's limit */
const MAX_LENGTH = 200;

/** Beheer → Bericht versturen (B4): push + sound to everyone after a second tap, and what was sent in the last 48 h. */
export default function BroadcastPane() {
  const { broadcasts, error, retry, send } = useBroadcasts(true);
  const { users } = useAdmin();
  const [message, setMessage] = useState('');
  const [state, dispatch] = useReducer(sendTransition, 'idle');
  const textarea = useRef<HTMLTextAreaElement>(null);
  // Counts every change of the text, so a finished send only clears the text it sent (not what was typed since)
  const revision = useRef(0);
  // Pointer over or focus on the send button: "Zeker?" waits for as long as that lasts
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const held = hovered || focused;

  const trimmed = message.trim();
  const view = broadcasts ? 'content' : error ? 'error' : 'loading';

  function changeMessage(next: string) {
    revision.current += 1;
    setMessage(next);
    // "Zeker?" was about the old text: editing asks again, so a second tap never sends unconfirmed text
    if (state === 'confirm') dispatch('expire');
  }

  // "Zeker?" falls back 8 s after the pointer and focus left the button, "Verstuurd" after 1.6 s
  useEffect(() => {
    if (state === 'confirm' ? held : state !== 'sent') return;
    const timeout = setTimeout(() => dispatch(state === 'confirm' ? 'expire' : 'reset'), state === 'confirm' ? SEND_CONFIRM_MS : SEND_DONE_MS);
    return () => clearTimeout(timeout);
  }, [state, held]);

  async function tap() {
    if (!trimmed || state === 'sending' || state === 'sent') return;
    dispatch('tap');
    // The first tap only asks
    if (state !== 'confirm') return;
    const sentRevision = revision.current;
    // Busy and "Verstuurd" ignore the pointer (no pointerleave): the next "Zeker?" picks it up again on pointermove
    setHovered(false);
    try {
      await send(trimmed);
      dispatch('success');
      if (revision.current === sentRevision) setMessage('');
      toast.success('Bericht verstuurd');
    } catch {
      dispatch('failure');
      toast.error('Versturen is mislukt, probeer het opnieuw.');
    }
  }

  /** "Opnieuw": the old message back in the text field (a pending "Zeker?" was about the old text, so it resets) */
  function reuse(broadcast: Broadcast) {
    changeMessage(broadcast.body.slice(0, MAX_LENGTH));
    textarea.current?.focus();
  }

  const row = (broadcast: Broadcast) => (
    <BeheerRow key={broadcast.id} title={<span className="min-w-0 font-medium break-words">{broadcast.body}</span>} meta={broadcastMeta(broadcast)}>
      <Pill disabled={state === 'sending'} onClick={() => reuse(broadcast)}>
        <RotateCcwIcon />
        Opnieuw
      </Pill>
    </BeheerRow>
  );

  return (
    <BeheerPane title="Bericht versturen" description="Iedereen krijgt dit als melding met geluid.">
      <BeheerCard title="Nieuw bericht">
        <textarea
          ref={textarea}
          value={message}
          maxLength={MAX_LENGTH}
          rows={3}
          onChange={(event) => changeMessage(event.target.value)}
          placeholder="Bijv. Iedereen terug naar HQ"
          aria-label="Bericht"
          // Not disabled: that would drop the focus
          readOnly={state === 'sending'}
          className="block min-h-[84px] w-full resize-none rounded-2xl bg-beheer-row px-3.5 py-3 text-base outline-none transition-shadow placeholder:text-muted-foreground focus-visible:shadow-[inset_0_0_0_1.5px_var(--ring)] read-only:opacity-60 desk:text-sm"
        />
        <div className="mt-2.5 flex items-center gap-3">
          <span className="flex-1 px-1 text-xs text-muted-foreground tabular-nums">
            {message.length} / {MAX_LENGTH}
          </span>
          <Pill
            size="md"
            morphKey={state}
            variant={state === 'confirm' ? 'warn' : state === 'sent' ? 'success' : 'primary'}
            // aria-disabled, not disabled, throughout: the button keeps the focus while it sends and after the text clears
            busy={state === 'sending'}
            aria-disabled={state === 'sent' || (state !== 'sending' && !trimmed) || undefined}
            // "Verstuurd" is a status, not a button: no dimming of the green
            className={cn(state === 'sent' && 'aria-disabled:opacity-100')}
            onClick={() => void tap()}
            onPointerEnter={() => setHovered(true)}
            onPointerMove={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          >
            {state === 'sending' && <Loader2Icon className="animate-spin" />}
            {state === 'sent' && <CheckIcon />}
            {state === 'idle' && <SendIcon />}
            {sendButtonLabel(state, users?.length)}
          </Pill>
          {/* Always mounted, so the text change is announced */}
          <span role="status" className="sr-only">
            {state === 'confirm' ? sendConfirmAnnouncement(users?.length) : ''}
          </span>
        </div>
      </BeheerCard>

      <AnimatePresence mode="wait" initial={false}>
        {view === 'loading' && (
          <motion.div key="loading" {...SWAP}>
            <BeheerSkeleton />
          </motion.div>
        )}
        {view === 'error' && (
          <motion.div key="error" {...SWAP}>
            <BeheerLoadError message="Kan de verstuurde berichten niet laden." onRetry={retry} />
          </motion.div>
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
