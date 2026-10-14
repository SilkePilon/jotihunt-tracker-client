import { type ReactNode, RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { XIcon } from 'lucide-react';
import { useSWRConfig } from 'swr';
import { IconPill } from '@/components/beheer/controls/Pill';
import { MapRef } from '@/components/Map';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import { useArticles } from '@/hooks/articles.hook';
import { useAssignments } from '@/hooks/assignments.hook';
import { useHintBoard } from '@/hooks/hints.hook';
import { useHasMounted } from '@/hooks/has-mounted.hook';
import { useIsMobile } from '@/hooks/media.hook';
import { useReadState } from '@/hooks/read-state.hook';
import { keepOpenWhileEditing } from '@/lib/inline-edit';
import { DETAIL_SWAP, buildIntelItems, filterByTab, unreadCount } from '@/lib/intel-window';
import { EASE_OUT } from '@/lib/motion';
import useIntelStore from '@/stores/intel.store';
import type { IntelItem } from '@/types/Intel';
import IntelDetail from './IntelDetail';
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
        // Escape inside an inline editor (a hint answer being changed) only cancels the edit
        keepOpenWhileEditing(event);
        if (event.defaultPrevented) return;
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

/** The window's content; only mounted while open (or closing). Polls fast while mounted. `mapRef` is for "Toon op kaart". */
function IntelWindow({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const tab = useIntelStore((state) => state.tab);
  const area = useIntelStore((state) => state.area);
  const { articles } = useArticles();
  const { board } = useHintBoard({ live: true });
  const { assignments } = useAssignments();
  const { readState, markRead } = useReadState();
  const items = useMemo(() => buildIntelItems({ articles, board, assignments, readState }), [articles, board, assignments, readState]);
  const shown = useMemo(() => filterByTab(items, tab), [items, tab]);
  const articleId = useIntelStore((state) => state.articleId);
  const select = useIntelStore((state) => state.select);
  const selected = shown.find((item) => item.id === articleId) ?? null;
  const split = selected !== null;
  const mounted = useHasMounted();
  const scrollRef = useRef<HTMLDivElement>(null);

  // The last selection that showed on the right (derived during render)
  const [resolvedId, setResolvedId] = useState<number | null>(null);
  if (selected && resolvedId !== selected.id) setResolvedId(selected.id);
  // A selection that showed and then left the tab (the tab changed, or the article went) closes the split. One that never
  // showed yet stays pending: a toast for a just-published article can be quicker than the next /articles poll.
  useEffect(() => {
    if (articleId !== null && articleId === resolvedId && !selected) select(null);
  }, [articleId, resolvedId, selected, select]);

  // A pending article that is not in the data yet: fetch articles and the hint board now instead of at the next poll.
  // Still not there after that fetch: drop it, so the split can't open out of the blue later.
  const { mutate } = useSWRConfig();
  const refreshedFor = useRef<number | null>(null);
  useEffect(() => {
    if (!articles || articleId === null || refreshedFor.current === articleId || items.some((item) => item.id === articleId)) return;
    refreshedFor.current = articleId;
    void mutate((key) => Array.isArray(key) && (key[0] === '/articles' || key[0] === '/hints/board')).then((results) => {
      const found = results.some((data) => Array.isArray(data) && data.some((article: { id?: number }) => article?.id === articleId));
      if (!found && useIntelStore.getState().articleId === articleId) select(null);
    });
  }, [articles, articleId, items, mutate, select]);

  // A pending selection does not survive a tab switch either, unless it came with it (openIntel sets both at once)
  const last = useRef({ tab, articleId });
  useEffect(() => {
    const tabChanged = last.current.tab !== tab;
    const articleChanged = last.current.articleId !== articleId;
    last.current = { tab, articleId };
    if (tabChanged && !articleChanged && articleId !== null && !selected) select(null);
  }, [tab, articleId, selected, select]);

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
      <IntelTopBar unread={{ news: unreadCount(items, 'news') > 0, assignment: unreadCount(items, 'assignment') > 0 }} />
      <div className="@container flex min-h-0 flex-1 overflow-hidden">
        <motion.div
          ref={scrollRef}
          className="min-h-0 shrink-0 overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]"
          initial={false}
          animate={{ width: split ? '33.333%' : '100%' }}
          transition={{ duration: 0.42, ease: EASE_OUT, delay: split ? 0.1 : 0.16 }}
        >
          <IntelTimeline items={shown} compact={split} tab={tab} scrollRef={scrollRef} selectedId={articleId} onSelect={(id) => select(id === articleId ? null : id)} />
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
              <DetailColumn item={selected} area={area} mapRef={mapRef} skipEntrance={!mounted} onClose={() => select(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * The right side of the split: its parts push in when the split opens, and swap (out, then rise in) for another item.
 * `skipEntrance` (read on mount): the window opened straight into the split (toast, mini grid), the dialog itself animates.
 */
function DetailColumn({ item, area, mapRef, skipEntrance, onClose }: { item: IntelItem; area: string | null; mapRef: RefObject<MapRef | null>; skipEntrance: boolean; onClose: () => void }) {
  const [skip] = useState(skipEntrance);
  // Derived during render: from the first other item on, items rise in instead of pushing in from the right
  const [firstId] = useState(item.id);
  const [swapped, setSwapped] = useState(false);
  if (!swapped && item.id !== firstId) setSwapped(true);

  return (
    <div className="relative mx-auto max-w-[720px]">
      {/* Outside the keyed slide: it stays put while items swap, and leaves with the whole column */}
      <motion.div
        className="absolute -top-1 -right-2 z-10"
        initial={skip ? false : { opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.3, delay: 0.2, ease: EASE_OUT } }}
      >
        <IconPill aria-label="Sluiten (Esc)" title="Sluiten (Esc)" onClick={onClose}>
          <XIcon />
        </IconPill>
      </motion.div>
      <AnimatePresence mode="wait">
        <DetailSlide key={item.id} swapped={swapped} skipEntrance={skip && !swapped}>
          <IntelDetail item={item} area={area} mapRef={mapRef} />
        </DetailSlide>
      </AnimatePresence>
    </div>
  );
}

/** One item on the right. Parts that mount later (while it is on screen) inherit `swap`, so they rise in too. */
function DetailSlide({ swapped, skipEntrance, children }: { swapped: boolean; skipEntrance: boolean; children: ReactNode }) {
  const [skip] = useState(skipEntrance);
  const mounted = useHasMounted();
  return (
    <motion.div
      custom={swapped}
      variants={DETAIL_SWAP}
      initial={mounted ? 'swap' : skip ? false : swapped ? 'swap' : 'open'}
      animate="shown"
      exit="gone"
    >
      {children}
    </motion.div>
  );
}
