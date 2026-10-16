import { lazy, type ReactNode, RefObject, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react';
import { useSWRConfig } from 'swr';
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
import { PUSH, buildIntelItems, filterByTab, unreadCount } from '@/lib/intel-window';
import { cn } from '@/lib/utils';
import useIntelStore from '@/stores/intel.store';
import type { HintCell } from '@/types/HintCell';
import type { IntelItem, IntelTab } from '@/types/Intel';
import IntelDetail from './IntelDetail';
import IntelTimeline from './IntelTimeline';
import IntelTopBar from './IntelTopBar';
import StatusCard from './StatusCard';

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
  const cells = useMemo(() => board?.cells ?? [], [board]);
  const { assignments } = useAssignments();
  const { readState, markRead } = useReadState();
  const items = useMemo(() => buildIntelItems({ articles, board, assignments, readState }), [articles, board, assignments, readState]);
  const shown = useMemo(() => filterByTab(items, tab), [items, tab]);
  const articleId = useIntelStore((state) => state.articleId);
  const select = useIntelStore((state) => state.select);
  const selected = shown.find((item) => item.id === articleId) ?? null;
  const mounted = useHasMounted();

  // A selection that showed and then left the list (the article went) goes back to the timeline. One that never
  // showed yet stays pending: a toast for a just-published article can be quicker than the next /articles poll.
  const shownIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (selected) shownIdRef.current = selected.id;
    else if (articleId !== null && articleId === shownIdRef.current) select(null);
  }, [articleId, selected, select]);

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

  // Where the timeline was scrolled (and on which tab), so going back puts the list where it was
  const timelineScroll = useRef<{ tab: IntelTab; top: number } | null>(null);

  // Derived during render: a key per view (timeline, or one per item) and which way it pushes. Forward (+1): timeline →
  // item, or to a newer item; back (−1): item → timeline, or to an older item. `gen` keys the view, so a quick
  // back-and-forth mounts a fresh one instead of reviving one that is still leaving.
  const viewKey = selected ? `item-${selected.id}` : 'timeline';
  const [view, setView] = useState({ key: viewKey, gen: 0, direction: 1, publishAt: selected?.publishAt ?? null });
  if (view.key !== viewKey) {
    const direction = !selected ? -1 : view.publishAt === null || selected.publishAt >= view.publishAt ? 1 : -1;
    setView({ key: viewKey, gen: view.gen + 1, direction, publishAt: selected?.publishAt ?? null });
  }

  // Views push sideways (PUSH); tabs push the list inside the timeline view (IntelTimeline). Reduced motion: direction 0,
  // so both views stay in place and cross-fade (motion would otherwise jump the leaving one sideways).
  const direction = useReducedMotion() ? 0 : view.direction;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <IntelTopBar detail={selected !== null} onBack={() => select(null)} unread={{ news: unreadCount(items, 'news') > 0, assignment: unreadCount(items, 'assignment') > 0 }} />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* No initial={false} here: motion would block the initial animation of everything inside the first view too
            (status card, bars, ring, chat empty state). PushView skips only its own push on the first view instead. */}
        <AnimatePresence custom={direction}>
          <PushView key={`${view.key}-${view.gen}`} direction={direction} first={!mounted}>
            {selected ? (
              <DetailView item={selected} area={area} mapRef={mapRef} entrance={!mounted} />
            ) : (
              <TimelineView items={shown} allItems={items} cells={cells} tab={tab} memoryRef={timelineScroll} entrance={!mounted} onSelect={select} />
            )}
          </PushView>
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * One view, pushed in and out sideways (PUSH, custom = direction). The leaving one sits underneath and takes no input.
 * `first` (read on mount): the window's first view, which arrives with the dialog instead of pushing in.
 */
function PushView({ direction, first, children }: { direction: number; first: boolean; children: ReactNode }) {
  const isPresent = useIsPresent();
  const [initial] = useState(first ? false : 'enter');
  return (
    <motion.div
      custom={direction}
      variants={PUSH}
      initial={initial}
      animate="center"
      exit="exit"
      inert={!isPresent}
      className={cn('absolute inset-0 flex flex-col', isPresent ? 'z-[1]' : 'pointer-events-none z-0')}
    >
      {children}
    </motion.div>
  );
}

interface TimelineViewProps {
  items: IntelItem[];
  allItems: IntelItem[];
  cells: HintCell[];
  tab: IntelTab;
  memoryRef: RefObject<{ tab: IntelTab; top: number } | null>;
  /** Read on mount: the window just opened (the cards stagger in, the status card counts up); later the timeline just comes back */
  entrance: boolean;
  onSelect: (id: number) => void;
}

/** The scrolling timeline (remembers its scroll position per tab) and the status card. */
function TimelineView({ items, allItems, cells, tab, memoryRef, entrance, onSelect }: TimelineViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Before the first paint: back to where the list was (same tab only)
  useLayoutEffect(() => {
    const scroller = ref.current;
    const saved = memoryRef.current;
    if (scroller && saved?.tab === tab) scroller.scrollTop = saved.top;
    // Mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A tab switch keeps the scroll container: remember the position for the new tab (scroll events follow from here)
  useLayoutEffect(() => {
    if (ref.current) memoryRef.current = { tab, top: ref.current.scrollTop };
  }, [tab, memoryRef]);
  return (
    <div className="flex min-h-0 flex-1 gap-3.5 px-4 pb-4">
      <div
        ref={ref}
        onScroll={(event) => {
          memoryRef.current = { tab, top: event.currentTarget.scrollTop };
        }}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]"
      >
        <IntelTimeline items={items} tab={tab} entrance={entrance} onSelect={onSelect} />
      </div>
      {/* Stats over every kind, whatever the tab */}
      <StatusCard items={allItems} cells={cells} entrance={entrance} />
    </div>
  );
}

/**
 * The open item: left its column (title card, summary, pane; scrolls on its own), right the AI chat card. Both start at
 * the top of the body, so the title card and the chat card line up. Another item replaces the whole view (a push).
 */
function DetailView({ item, area, mapRef, entrance }: { item: IntelItem; area: string | null; mapRef: RefObject<MapRef | null>; entrance: boolean }) {
  // The window opened straight on this item: the chat waits for nothing (the dialog's own entrance plays); pushed in later: its empty state staggers in after the push
  const [firstPaint] = useState(entrance);
  return (
    <div className="flex min-h-0 flex-1 gap-3.5 px-4 pb-4">
      <div className="@container min-h-0 min-w-0 flex-[1.25] overflow-y-auto pr-1 [scrollbar-gutter:stable]">
        <IntelDetail item={item} area={area} mapRef={mapRef} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* While the chunk loads: the chat card's empty shell (IntelChat's root classes) */}
        <Suspense fallback={<div className="flex min-h-0 flex-1 flex-col rounded-[24px] bg-card p-3.5" />}>
          <IntelChat item={item} mapRef={mapRef} entrance={!firstPaint} />
        </Suspense>
      </div>
    </div>
  );
}
