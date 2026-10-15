import { AnimatePresence, motion } from 'motion/react';
import { suggestionChips } from '@/lib/intel-chat';
import { CHAT_EMPTY, CHAT_EMPTY_PART } from '@/lib/intel-window';
import { POP } from '@/lib/motion';
import type { IntelItem } from '@/types/Intel';

interface ChatEmptyProps {
  item: IntelItem;
  /** A turn is running or the AI is not set up: chips can't send */
  disabled: boolean;
  /** A chip was clicked: send its text */
  onPick: (text: string) => void;
  /** Seconds before the parts stagger in (after the card's entrance) */
  delay?: number;
}

/** E2: centred tonal ✦ block, "Samen puzzelen", one line, chips per kind (a solved area's chip pops out) */
export default function ChatEmpty({ item, disabled, onPick, delay = 0 }: ChatEmptyProps) {
  const chips = suggestionChips(item);
  return (
    <motion.div variants={CHAT_EMPTY} custom={delay} initial="hidden" animate="shown" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2.5 px-4 text-center">
      <motion.div variants={CHAT_EMPTY_PART} aria-hidden className="grid size-[54px] place-items-center rounded-[18px] bg-fox-warn-container text-[26px] text-fox-on-warn">
        ✦
      </motion.div>
      <motion.p variants={CHAT_EMPTY_PART} className="text-[15px] font-bold">
        Samen puzzelen
      </motion.p>
      <motion.p variants={CHAT_EMPTY_PART} className="max-w-[260px] text-[12.5px] leading-relaxed text-muted-foreground">
        Ik ken dit item, de kaart, groepen en vossen, en kan op internet zoeken.
      </motion.p>
      <motion.div variants={CHAT_EMPTY_PART} className="relative mt-1 flex flex-wrap justify-center gap-1.5">
        <AnimatePresence initial={false} mode="popLayout">
          {chips.map((chip) => (
            <motion.button
              key={chip}
              layout
              {...POP}
              type="button"
              disabled={disabled}
              onClick={() => onPick(chip)}
              style={{ borderRadius: 12 }}
              className="bg-beheer-row-high px-2.5 py-1.5 text-xs font-semibold outline-none transition-colors hover:bg-beheer-row-high/70 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
            >
              {chip}
            </motion.button>
          ))}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
