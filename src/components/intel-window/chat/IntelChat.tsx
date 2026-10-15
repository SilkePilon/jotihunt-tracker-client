import type { ReactNode, RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { MapRef } from '@/components/Map';
import { CONTEXT_LABEL } from '@/lib/intel-chat';
import type { IntelItem, IntelKind } from '@/types/Intel';

interface IntelChatProps {
  item: IntelItem;
  /** For "Toon op kaart" on point cards */
  mapRef: RefObject<MapRef | null>;
}

const FADE = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } };

/** The AI chat card right of the open item (layout B). Its content swaps (fades) when another item opens. */
export default function IntelChat({ item }: IntelChatProps) {
  return (
    <section aria-label="Vraag de AI" className="flex min-h-0 flex-1 flex-col rounded-[24px] bg-card p-3.5">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={item.id} {...FADE} className="flex min-h-0 flex-1 flex-col gap-2.5">
          <ChatHeader kind={item.kind} />
          <div className="min-h-0 flex-1" />
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function ChatHeader({ kind, action }: { kind: IntelKind; action?: ReactNode }) {
  return (
    <div className="mx-1 flex items-center gap-2">
      <span aria-hidden className="text-base leading-none text-fox-warn">
        ✦
      </span>
      <h3 className="text-[15px] font-bold">Vraag de AI</h3>
      <span className="ml-auto rounded-lg bg-beheer-row-high px-2 py-0.5 text-[11.5px] font-semibold text-muted-foreground">{CONTEXT_LABEL[kind]}</span>
      {action}
    </div>
  );
}
