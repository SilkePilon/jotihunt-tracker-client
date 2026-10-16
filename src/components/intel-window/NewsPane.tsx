import { AnimatePresence, motion } from 'motion/react';
import { BeheerCard } from '@/components/beheer/BeheerLayout';
import { POP } from '@/lib/motion';
import type { IntelItem } from '@/types/Intel';
import ArticleHtml from './ArticleHtml';

/** Nieuws (spec O): the full text, then who opened it. The cards arrive with the detail view (no stagger of their own). */
export default function NewsPane({ item }: { item: IntelItem }) {
  return (
    <>
      <div>
        <BeheerCard title="Volledige tekst">
          <ArticleHtml html={item.content} />
        </BeheerCard>
      </div>
      <div>
        <BeheerCard title="Gelezen door" count={item.readBy.length}>
          {/* No `layout` on the chips: the first name (our own, from the mark-read) usually lands while the card still slides in */}
          <div className="relative flex flex-wrap gap-1.5">
            <AnimatePresence initial={false} mode="popLayout">
              {item.readBy.map((name) => (
                <motion.span key={`name:${name}`} {...POP} className="rounded-lg bg-beheer-row px-2.5 py-1 text-xs">
                  {name}
                </motion.span>
              ))}
              {item.readBy.length === 0 && (
                <motion.span key="none" className="px-1 py-1 text-xs text-muted-foreground" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }}>
                  Nog niemand
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </BeheerCard>
      </div>
    </>
  );
}
