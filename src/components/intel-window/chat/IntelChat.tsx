import { type ReactNode, type RefObject, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2Icon, RotateCcwIcon, SquarePenIcon } from 'lucide-react';
import { toast } from 'sonner';
import { IconPill, Pill } from '@/components/beheer/controls/Pill';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { MapRef } from '@/components/Map';
import { useHasMounted } from '@/hooks/has-mounted.hook';
import Reveal from '@/components/motion/Reveal';
import { apiErrorMessage } from '@/lib/api-error';
import { BUSY_MESSAGE, CONTEXT_LABEL, chatStatusLabel, lastUserMessageId } from '@/lib/intel-chat';
import { CHAT_EMPTY_ENTRANCE_DELAY, CHAT_MESSAGE } from '@/lib/intel-window';
import { POP, SWAP } from '@/lib/motion';
import type { IntelItem, IntelKind } from '@/types/Intel';
import ChatEmpty from './ChatEmpty';
import ChatInput from './ChatInput';
import ChatMessage from './ChatMessage';
import ToolStatus from './ToolStatus';
import { ChatScrollerContext, useStickToBottom } from './stick-to-bottom';
import { type IntelChatState, useIntelChat } from './useIntelChat';

interface IntelChatProps {
  item: IntelItem;
  /** For "Toon op kaart" on point cards */
  mapRef: RefObject<MapRef | null>;
  /** Pushed in after the window opened: the empty state staggers in after the view push (not when the window opens straight on an item) */
  entrance: boolean;
}

const FADE = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } };

/** The AI chat card right of the open item (layout B). Remounts per item (the detail view is keyed); each item has its own conversation. */
export default function IntelChat({ item, mapRef, entrance }: IntelChatProps) {
  return (
    <section aria-label="Vraag de AI" className="flex min-h-0 flex-1 flex-col gap-2.5 rounded-[24px] bg-card p-3.5">
      <ChatPanel item={item} mapRef={mapRef} entrance={entrance} />
    </section>
  );
}

function ChatPanel({ item, mapRef, entrance }: IntelChatProps) {
  const chat = useIntelChat(item.id);
  const [confirmReset, setConfirmReset] = useState(false);
  const busy = chat.status === 'submitted' || chat.status === 'streaming';
  const scene = chat.loading ? 'loading' : chat.loadError ? 'load-error' : chat.messages.length === 0 ? 'empty' : 'thread';
  // The delayed empty stagger only applies until the first settled scene is left
  // (e.g. "Nieuw gesprek" afterwards shows the empty state without the entrance wait)
  const [emptyDelay, setEmptyDelay] = useState(entrance);
  const [prevScene, setPrevScene] = useState(scene);
  const mounted = useHasMounted();
  if (scene !== prevScene) {
    setPrevScene(scene);
    if (prevScene !== 'loading') setEmptyDelay(false);
  }

  async function reset() {
    try {
      await chat.reset();
      setConfirmReset(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Gesprek wissen mislukt'));
    }
  }

  return (
    <>
      <ChatHeader
        kind={item.kind}
        action={
          <AnimatePresence initial={false}>
            {chat.messages.length > 0 && (
              <motion.span key="new" {...POP} className="-my-1.5 inline-grid">
                <IconPill aria-label="Nieuw gesprek" title="Nieuw gesprek" onClick={() => setConfirmReset(true)}>
                  <SquarePenIcon />
                </IconPill>
              </motion.span>
            )}
          </AnimatePresence>
        }
      />
      {/* Nieuw gesprek: the thread fades out, the empty state rises in (its parts stagger; the wrapper only fades). The
          first scene doesn't fade in (no initial={false} here, that would also block the empty state's stagger). */}
      <AnimatePresence mode="wait">
        {scene === 'loading' ? (
          <motion.div key="loading" {...FADE} initial={mounted ? FADE.initial : false} className="grid min-h-0 flex-1 place-items-center">
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" aria-label="Gesprek laden…" />
          </motion.div>
        ) : scene === 'load-error' ? (
          <motion.div key="load-error" {...FADE} initial={mounted ? FADE.initial : false} className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-[13px] text-muted-foreground">
            Gesprek laden mislukt
            <Pill onClick={chat.reload}>
              <RotateCcwIcon />
              Opnieuw
            </Pill>
          </motion.div>
        ) : scene === 'empty' ? (
          <motion.div key="empty" className="flex min-h-0 flex-1 flex-col" initial={mounted ? { opacity: 0 } : false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <ChatEmpty item={item} disabled={busy || chat.unavailable} onPick={chat.send} delay={emptyDelay ? CHAT_EMPTY_ENTRANCE_DELAY : 0} stagger={mounted || emptyDelay} />
          </motion.div>
        ) : (
          <motion.div key="thread" {...FADE} initial={mounted ? FADE.initial : false} className="flex min-h-0 flex-1 flex-col">
            <ChatThread chat={chat} mapRef={mapRef} />
          </motion.div>
        )}
      </AnimatePresence>
      <ChatFooter chat={chat} kind={item.kind} busy={busy} />
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Nieuw gesprek beginnen?"
        description="Dit gesprek wordt gewist, ook op je andere apparaten."
        confirmLabel="Wissen"
        destructive
        onConfirm={reset}
      />
    </>
  );
}

function ChatHeader({ kind, action }: { kind: IntelKind; action?: ReactNode }) {
  return (
    <div className="mx-1 flex items-center gap-2">
      <h3 className="text-[15px] font-bold">Vraag de AI</h3>
      <span className="ml-auto rounded-lg bg-beheer-row-high px-2 py-0.5 text-[11.5px] font-semibold text-muted-foreground">{CONTEXT_LABEL[kind]}</span>
      {action}
    </div>
  );
}

/** Messages (rise in), the status line while the AI works, and an error row with "Opnieuw" */
function ChatThread({ chat, mapRef }: { chat: IntelChatState; mapRef: RefObject<MapRef | null> }) {
  const { scrollerRef, contentRef, onScroll } = useStickToBottom(lastUserMessageId(chat.messages));
  const busy = chat.status === 'submitted' || chat.status === 'streaming';
  const last = chat.messages.at(-1);
  return (
    <div ref={scrollerRef} onScroll={onScroll} className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 [scrollbar-gutter:stable]">
      <div ref={contentRef} className="flex min-h-full flex-col justify-end gap-3 py-1">
        <ChatScrollerContext.Provider value={scrollerRef}>
          <AnimatePresence initial={false}>
            {chat.messages.map((message) => (
              <motion.div key={message.id} {...CHAT_MESSAGE}>
                <ChatMessage message={message} streaming={busy && message === last} mapRef={mapRef} />
              </motion.div>
            ))}
          </AnimatePresence>
        </ChatScrollerContext.Provider>
        <ToolStatus label={chatStatusLabel(chat.messages, chat.status)} />
        <Reveal>{chat.status === 'error' && !chat.unavailable && <ErrorRow busy={chat.errorKind === 'busy'} onRetry={chat.retry} />}</Reveal>
      </div>
    </div>
  );
}

function ErrorRow({ busy, onRetry }: { busy: boolean; onRetry: () => void }) {
  return (
    <div className="mx-1 flex items-center gap-2 rounded-xl bg-destructive/12 py-1.5 pr-1.5 pl-3 text-[12.5px] text-destructive dark:text-red-300">
      <span className="flex-1">{busy ? BUSY_MESSAGE : 'Er ging iets mis'}</span>
      <Pill variant="danger-soft" onClick={onRetry}>
        <RotateCcwIcon />
        Opnieuw
      </Pill>
    </div>
  );
}

/** The prompt box, or "AI is niet ingesteld" when the server has no Gemini key (503) */
function ChatFooter({ chat, kind, busy }: { chat: IntelChatState; kind: IntelKind; busy: boolean }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {chat.unavailable ? (
        <motion.div key="off" {...SWAP} className="rounded-[20px] bg-beheer-row-high px-3.5 py-3 text-[13px] text-muted-foreground">
          AI is niet ingesteld
        </motion.div>
      ) : (
        <motion.div key="input" {...SWAP}>
          <ChatInput kind={kind} busy={busy} disabled={chat.loading || chat.loadError} onSend={chat.send} onStop={chat.stop} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
