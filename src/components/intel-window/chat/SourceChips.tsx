import { AnimatePresence, motion } from 'motion/react';
import type { ChatSource } from '@/lib/intel-chat';
import { POP } from '@/lib/motion';

/** Web sources of the answer as cooldown-blue chips; open in a new tab */
export default function SourceChips({ sources }: { sources: ChatSource[] }) {
  return (
    <div className="relative flex flex-wrap gap-1.5">
      <AnimatePresence initial={false} mode="popLayout">
        {sources.map((source) => (
          <motion.a
            key={source.url}
            layout
            {...POP}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            title={source.url}
            className="max-w-[220px] truncate rounded-lg bg-fox-cooldown-container px-2 py-0.5 text-[11.5px] font-medium text-fox-on-cooldown outline-none hover:brightness-110 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {source.title}
          </motion.a>
        ))}
      </AnimatePresence>
    </div>
  );
}
