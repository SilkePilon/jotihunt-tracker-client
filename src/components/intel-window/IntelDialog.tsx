import { RefObject, useContext, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, PresenceContext } from 'motion/react';
import { MapRef } from '@/components/Map';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import { useArticles } from '@/hooks/articles.hook';
import { useAssignments } from '@/hooks/assignments.hook';
import { useHintBoard } from '@/hooks/hints.hook';
import { useIsMobile } from '@/hooks/media.hook';
import { useReadState } from '@/hooks/read-state.hook';
import { DETAIL_PART, DETAIL_SWAP, buildIntelItems, filterByTab, unreadCount } from '@/lib/intel-window';
import { EASE_OUT } from '@/lib/motion';
import useIntelStore from '@/stores/intel.store';
import type { IntelItem } from '@/types/Intel';
import IntelTimeline from './IntelTimeline';
import IntelTopBar from './IntelTopBar';

/** Desktop window with hints, opdrachten and nieuws (phones keep the sidebar mini grid). */
export default function IntelDialog({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const isMobile = useIsMobile();
  const open = useIntelStore((state) => state.open);
  const close = useIntelStore((state) => state.close);

  // The store is global: Layout unmounts on /login, and a window left open would pop up again after the next login
  useEffect(() => () => useIntelStore.getState().close(), []);
  // Shrinking the window to phone size closes it
  useEffect(() => {
    if (isMobile && useIntelStore.getState().open) close();
  }, [isMobile, close]);

  if (isMobile) return null;
  return (
    <ResponsiveDialog
      open={open}
      onClose={close}
      title="Intel"
      description="Hints, opdrachten en nieuws."
      hideHeader
      onEscapeKeyDown={(event) => {
        // Escape first closes the item on the right, then the window
        const { articleId, select } = useIntelStore.getState();
        if (articleId !== null) {
          event.preventDefault();
          select(null);
        }
      }}
      className="h-[720px] max-h-[85dvh] gap-0 overflow-hidden bg-beheer-window p-0 sm:max-w-[1160px] sm:rounded-[20px]"
    >
      <IntelWindow mapRef={mapRef} />
    </ResponsiveDialog>
  );
}

/** The window's content; only mounted while open (or closing). Polls fast while mounted. `mapRef` is for "Toon op kaart" (Task 5). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- mapRef is used from Task 5 on
function IntelWindow(_props: { mapRef: RefObject<MapRef | null> }) {
  const tab = useIntelStore((state) => state.tab);
  const { articles } = useArticles();
  const { board } = useHintBoard({ live: true });
  const { assignments } = useAssignments();
  const { readState, markRead } = useReadState();
  const items = useMemo(() => buildIntelItems({ articles, board, assignments, readState }), [articles, board, assignments, readState]);
  const shown = useMemo(() => filterByTab(items, tab), [items, tab]);
  const articleId = useIntelStore((state) => state.articleId);
  const select = useIntelStore((state) => state.select);
  // A selected article that is not in the tab (the tab changed, or it disappeared) closes the split
  const selected = shown.find((item) => item.id === articleId) ?? null;
  const split = selected !== null;

  useEffect(() => {
    // Wait for the articles: an article opened from a toast or the mini grid is not "gone" while they load
    if (articles && articleId !== null && !shown.some((item) => item.id === articleId)) select(null);
  }, [articles, articleId, shown, select]);

  // Opening news or an opdracht marks it read (hints have no read state)
  useEffect(() => {
    if (selected && selected.kind !== 'hint' && selected.unread) void markRead(selected.id);
  }, [selected, markRead]);

  /*
   * Split choreography (T1). Open: the wide list fades out (0.13 s), the column shrinks 100% → 33.333% (0.42 s from
   * 0.1 s; the wide list is laid out at full row width, so it is only clipped, never re-wrapped), the compact rows stagger
   * in, the separator grows down and the detail (fixed at its final width, in an overflow-hidden row) is pushed in from
   * the right while its parts stagger in. Close: detail, separator and compact rows fade out, then the column grows back
   * and the wide list staggers in. Swap: only the right side changes (DETAIL_SWAP).
   */
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <IntelTopBar unread={unreadCount(items) > 0} />
      <div className="@container flex min-h-0 flex-1 overflow-hidden">
        <motion.div
          className="min-h-0 shrink-0 overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]"
          initial={false}
          animate={{ width: split ? '33.333%' : '100%' }}
          transition={{ duration: 0.42, ease: EASE_OUT, delay: split ? 0.1 : 0.16 }}
        >
          <IntelTimeline items={shown} compact={split} selectedId={articleId} onSelect={(id) => select(id === articleId ? null : id)} />
        </motion.div>
        <AnimatePresence initial={false}>
          {split && (
            <motion.div
              key="separator"
              className="mt-1 mb-[18px] w-px shrink-0 origin-top bg-border"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1, opacity: 1, transition: { duration: 0.5, delay: 0.12, ease: EASE_OUT } }}
              exit={{ opacity: 0, transition: { duration: 0.16 } }}
            />
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {selected && (
            <motion.div
              key="detail"
              className="min-h-0 shrink-0 basis-[calc(66.667%-1px)] overflow-y-auto px-9 pt-1.5 pb-8"
              exit={{ opacity: 0, x: 24, transition: { duration: 0.16, ease: 'easeIn' } }}
            >
              <DetailColumn item={selected} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** The right side of the split: its parts push in when the split opens, and swap (out, then rise in) for another item */
function DetailColumn({ item }: { item: IntelItem }) {
  // false when the window opened straight into the split (toast, mini grid): no entrance then, the dialog itself animates
  const presence = useContext(PresenceContext);
  const [entering] = useState(presence?.initial !== false);
  // Derived during render: from the first other item on, items rise in instead of pushing in from the right
  const [firstId] = useState(item.id);
  const [swapped, setSwapped] = useState(false);
  if (!swapped && item.id !== firstId) setSwapped(true);

  return (
    <AnimatePresence mode="wait" initial={entering}>
      <motion.div key={item.id} custom={swapped} variants={DETAIL_SWAP} initial={swapped ? 'swap' : 'open'} animate="shown" exit="gone" className="relative mx-auto max-w-[720px]">
        {/* Task 5: <IntelDetail item={item} mapRef={mapRef} />, its top-level parts with variants={DETAIL_PART} */}
        <motion.h2 variants={DETAIL_PART} className="text-[21px] font-bold">
          {item.title}
        </motion.h2>
      </motion.div>
    </AnimatePresence>
  );
}
