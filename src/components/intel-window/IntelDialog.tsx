import { lazy, type ReactNode, RefObject, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useIsPresent } from 'motion/react';
import { ArrowLeftIcon } from 'lucide-react';
import { useSWRConfig } from 'swr';
import { Pill } from '@/components/beheer/controls/Pill';
import { MapRef } from '@/components/Map';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import { useArticles } from '@/hooks/articles.hook';
import { useAssignments } from '@/hooks/assignments.hook';
import { useHintBoard } from '@/hooks/hints.hook';
import { useHasMounted } from '@/hooks/has-mounted.hook';
import { useIsMobile } from '@/hooks/media.hook';
import { useReadState } from '@/hooks/read-state.hook';
import { DIALOG_SHELL } from '@/lib/dialog-shell';
import { keepOpenWhileEditing } from '@/lib/inline-edit';
import { CHAT_CARD_ENTER, DETAIL_SWAP, buildIntelItems, filterByTab, unreadCount } from '@/lib/intel-window';
import { EASE_OUT } from '@/lib/motion';
import { cn } from '@/lib/utils';
import useIntelStore from '@/stores/intel.store';
import type { IntelItem, IntelTab } from '@/types/Intel';
import IntelDetail from './IntelDetail';
import IntelTimeline from './IntelTimeline';
import IntelTopBar from './IntelTopBar';

// The AI chat (with the AI SDK) is its own chunk, fetched when the window opens
const loadIntelChat = () => import('./chat/IntelChat');
const IntelChat = lazy(loadIntelChat);

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
  useEffect(() => {
    if (open && !isMobile) void loadIntelChat();
  }, [open, isMobile]);

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
        // Escape first goes back from an item to the timeline, then closes the window
        const { articleId, select } = useIntelStore.getState();
        if (articleId !== null) {
          event.preventDefault();
          select(null);
        }
      }}
      // Shell shared with Account/Meldingen; the window rises 18px instead of the default zoom
      className={cn(
        DIALOG_SHELL,
        'h-[720px] max-h-[85dvh] gap-0 overflow-hidden bg-beheer-window p-0 sm:max-w-[1160px] data-[state=open]:zoom-in-100 data-[state=open]:slide-in-from-bottom-[18px] data-[state=open]:duration-[380ms]',
      )}
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
  const mounted = useHasMounted();

  // The last selection that showed (derived during render); its card morphs back when the detail closes
  const [resolvedId, setResolvedId] = useState<number | null>(null);
  if (selected && resolvedId !== selected.id) setResolvedId(selected.id);
  // A selection that showed and then left the list (the article went) goes back to the timeline. One that never
  // showed yet stays pending: a toast for a just-published article can be quicker than the next /articles poll.
  useEffect(() => {
    if (articleId !== null && articleId === resolvedId && !selected) select(null);
  }, [articleId, resolvedId, selected, select]);

  // A pending article that is not in the data yet: fetch articles and the hint board now instead of at the next poll.
  // Still not there after that fetch: drop it, so the detail can't open out of the blue later.
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

  // Opening news or an opdracht marks it read (hints have no read state)
  useEffect(() => {
    if (selected && selected.kind !== 'hint' && selected.unread) void markRead(selected.id);
  }, [selected, markRead]);

  // Where the timeline was scrolled (and on which tab), so going back puts the card where it was clicked
  const timelineScroll = useRef<{ tab: IntelTab; top: number } | null>(null);

  // Derived during render. `gen` keys the views, so a quick back-and-forth mounts a fresh view (with a fresh morph)
  // instead of reviving one that is still fading out. `from`: the timeline's tab when the detail opened (openIntel can
  // switch the tab in the same go); only going back to that tab morphs the card home.
  const split = selected !== null;
  const [timelineTab, setTimelineTab] = useState(tab);
  if (!split && timelineTab !== tab) setTimelineTab(tab);
  const [view, setView] = useState({ split, gen: 0, from: tab });
  if (view.split !== split) setView({ split, gen: view.gen + 1, from: split ? timelineTab : view.from });
  const returnId = view.from === tab ? resolvedId : null;

  /*
   * Detail choreography. Open: the timeline fades out (0.16 s) underneath while the clicked card's frame and title morph
   * (shared layoutId, INTEL_MORPH) into the detail header on top, then the parts below stagger in. Back: the detail fades
   * out underneath while the header morphs back into its card on top of the timeline, which is scrolled back to where it
   * was; the other cards stagger in and the returning card's tags fade in as it lands. Swap: only the detail content
   * changes (DETAIL_SWAP). The views are stacked (absolute), so the leaving one never moves the entering one.
   */
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <IntelTopBar unread={{ news: unreadCount(items, 'news') > 0, assignment: unreadCount(items, 'assignment') > 0 }} />
      <div className="relative min-h-0 flex-1">
        <AnimatePresence initial={false}>
          {selected ? (
            <View key={`detail-${view.gen}`}>
              <DetailView item={selected} area={area} mapRef={mapRef} skipEntrance={!mounted} onBack={() => select(null)} />
            </View>
          ) : (
            <View key={`timeline-${view.gen}`}>
              <TimelineView items={shown} tab={tab} memoryRef={timelineScroll} skipEntrance={!mounted} returnId={returnId} onSelect={select} />
            </View>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** One of the stacked views. The entering one paints on top; the leaving one fades out underneath and takes no input. */
function View({ children }: { children: ReactNode }) {
  const isPresent = useIsPresent();
  return (
    <motion.div
      className={cn('absolute inset-0 flex flex-col', isPresent ? 'z-[1]' : 'pointer-events-none z-0')}
      inert={!isPresent}
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.16, ease: 'easeIn' } }}
    >
      {children}
    </motion.div>
  );
}

interface TimelineViewProps {
  items: IntelItem[];
  tab: IntelTab;
  memoryRef: RefObject<{ tab: IntelTab; top: number } | null>;
  skipEntrance: boolean;
  returnId: number | null;
  onSelect: (id: number) => void;
}

/** The scrolling timeline. `layoutScroll`: the card morph accounts for its scroll position. */
function TimelineView({ items, tab, memoryRef, skipEntrance, returnId, onSelect }: TimelineViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Before motion measures the returning card (a microtask after this commit): back to where the list was (same tab
  // only), then, if the returning card is not in view there (another item was swapped in, or the window opened on the
  // item), centre it so it never flies home off-screen
  useLayoutEffect(() => {
    const scroller = ref.current;
    if (!scroller) return;
    const saved = memoryRef.current;
    if (saved?.tab === tab) scroller.scrollTop = saved.top;
    const row = returnId === null ? null : scroller.querySelector(`[data-intel-id="${returnId}"]`);
    if (!row) return;
    const box = scroller.getBoundingClientRect();
    const card = row.getBoundingClientRect();
    // 44px: the sticky day header covers the top
    if (card.top < box.top + 44 || card.bottom > box.bottom) scroller.scrollTop += card.top - box.top - Math.max(44, (box.height - card.height) / 2);
    // Mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A tab switch keeps the scroll container: remember the position for the new tab (scroll events follow from here)
  useLayoutEffect(() => {
    if (ref.current) memoryRef.current = { tab, top: ref.current.scrollTop };
  }, [tab, memoryRef]);
  return (
    <motion.div
      ref={ref}
      layoutScroll
      onScroll={(event) => {
        memoryRef.current = { tab, top: event.currentTarget.scrollTop };
      }}
      className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]"
    >
      <IntelTimeline items={items} tab={tab} skipEntrance={skipEntrance} returnId={returnId} onSelect={onSelect} />
    </motion.div>
  );
}

/**
 * The open item (layout B): left the item column ("Tijdlijn" pill floating over its top, scrolling on its own), right
 * the AI chat card over the full height. Opening from the timeline, the chat card slides in after the item's parts; going
 * back, it fades out with the rest of the view.
 */
function DetailView({ item, area, mapRef, skipEntrance, onBack }: { item: IntelItem; area: string | null; mapRef: RefObject<MapRef | null>; skipEntrance: boolean; onBack: () => void }) {
  const [skip] = useState(skipEntrance);
  return (
    <div className="flex min-h-0 flex-1 gap-4 pr-[18px] pb-[18px]">
      <div className="relative flex min-w-0 flex-[1.25] flex-col">
        {/* The scroller fills the column (a card high up in the timeline morphs in without being clipped at the top);
            the pill floats over its top, content scrolls away under the fade */}
        <motion.div layoutScroll className="min-h-0 flex-1 overflow-y-auto pt-12 pr-2 pb-8 pl-[26px] [scrollbar-gutter:stable]">
          <DetailColumn item={item} area={area} mapRef={mapRef} skipEntrance={skip} />
        </motion.div>
        <motion.div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-12 items-start bg-linear-to-b from-beheer-window from-70% to-transparent pl-6"
          initial={skip ? false : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0, transition: { duration: 0.3, delay: 0.12, ease: EASE_OUT } }}
        >
          <Pill className="pointer-events-auto" onClick={onBack} title="Terug naar de tijdlijn (Esc)">
            <ArrowLeftIcon />
            Tijdlijn
          </Pill>
        </motion.div>
      </div>
      <motion.div className="flex min-w-0 flex-1 flex-col" initial={skip ? false : CHAT_CARD_ENTER.initial} animate={CHAT_CARD_ENTER.animate} transition={CHAT_CARD_ENTER.transition}>
        {/* While the chunk loads: the chat card's empty shell (IntelChat's root classes) */}
        <Suspense fallback={<div className="flex min-h-0 flex-1 flex-col rounded-[24px] bg-card p-3.5" />}>
          <IntelChat item={item} mapRef={mapRef} entrance={!skip} />
        </Suspense>
      </motion.div>
    </div>
  );
}

/**
 * The detail content: from the timeline its header is in place for the morph and the parts below rise in; another item
 * (mini grid, toast) swaps it (out, then rise in). `skipEntrance` (read on mount): the window opened straight on an item.
 */
function DetailColumn({ item, area, mapRef, skipEntrance }: { item: IntelItem; area: string | null; mapRef: RefObject<MapRef | null>; skipEntrance: boolean }) {
  // Derived during render: from the first other item on, items rise in
  const [firstId] = useState(item.id);
  const [swapped, setSwapped] = useState(false);
  if (!swapped && item.id !== firstId) setSwapped(true);

  return (
    <AnimatePresence mode="wait">
      {/* Full column width; an opdracht stacks status and notes when the column is narrow (@container in AssignmentPane) */}
      <DetailSlide key={item.id} swapped={swapped} skipEntrance={skipEntrance && !swapped} className="w-full">
        <IntelDetail item={item} area={area} mapRef={mapRef} />
      </DetailSlide>
    </AnimatePresence>
  );
}

/** One item (its own width, so a leaving item never reflows). Parts that mount later inherit `swap`, so they rise in too. */
function DetailSlide({ swapped, skipEntrance, className, children }: { swapped: boolean; skipEntrance: boolean; className: string; children: ReactNode }) {
  const [skip] = useState(skipEntrance);
  const mounted = useHasMounted();
  return (
    <motion.div
      custom={swapped}
      variants={DETAIL_SWAP}
      initial={mounted ? 'swap' : skip ? false : swapped ? 'swap' : 'open'}
      animate="shown"
      exit="gone"
      className={cn('@container mx-auto', className)}
    >
      {children}
    </motion.div>
  );
}
