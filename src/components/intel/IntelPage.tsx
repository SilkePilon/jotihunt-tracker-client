import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useArticles } from '@/hooks/articles.hook';
import { useAssignments } from '@/hooks/assignments.hook';
import { useHintBoard } from '@/hooks/hints.hook';
import { useNextHint } from '@/hooks/next-hint.hook';
import { usePresence } from '@/hooks/presence.hook';
import { useReadState } from '@/hooks/read-state.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { buildIntelItems, filterIntelItems, intelCounts, parseSelection, selectionSearch } from '@/lib/intel';
import { areaOptions } from '@/lib/utils';
import type { IntelFilter, IntelItem } from '@/types/Intel';
import type { User } from '@/types/User';
import IntelFilters from './IntelFilters';
import IntelList from './IntelList';
import IntelReader from './IntelReader';
import IntelTopBar from './IntelTopBar';

/** The first area (in the usual order) that still needs work, else the first area of the hint */
function firstOpenArea(item: IntelItem): string | undefined {
  const cells = areaOptions.flatMap(({ value }) => item.cells.filter((cell) => cell.area === value));
  return (cells.find((cell) => cell.status === 'open' || cell.status === 'solving') ?? cells[0] ?? item.cells[0])?.area;
}

/** The query string that selects an item; a hint keeps the current area when it has that area, else its first open one */
function searchFor(item: IntelItem, currentArea?: string): string {
  if (item.type !== 'hint') return selectionSearch(item.id).slice(1);
  // Cells not loaded yet: keep the area of the link, it is checked once they are there
  if (item.cells.length === 0) return selectionSearch(item.id, currentArea).slice(1);
  const area = currentArea && item.cells.some((cell) => cell.area === currentArea) ? currentArea : firstOpenArea(item);
  return selectionSearch(item.id, area).slice(1);
}

/**
 * The hints page on a desktop: all hints, assignments and news in one filterable list, with the selected one to read
 * in the centre. It covers the map, which stays mounted underneath.
 */
export default function IntelPage() {
  const { articles } = useArticles();
  const { board } = useHintBoard({ live: true });
  const { assignments } = useAssignments();
  const { readState, markRead } = useReadState();
  const { label: nextHint } = useNextHint();
  const selfId = useAuthUser<User>()?._id;

  const [filter, setFilter] = useState<IntelFilter>({ type: 'all', query: '', openOnly: false });
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), 1000);

  const items = useMemo(() => buildIntelItems({ articles, board, assignments, readState }), [articles, board, assignments, readState]);
  const filtered = useMemo(() => filterIntelItems(items, filter), [items, filter]);
  const counts = useMemo(() => intelCounts(items), [items]);

  const [params, setParams] = useSearchParams();
  const selection = parseSelection(params);
  const selected = items.find((item) => item.id === selection.itemId);
  const presence = usePresence(selected?.id, selected?.type === 'hint' ? selection.area : undefined);

  // Nothing selected yet: the first row. A hint without a (valid) area: its first open area. As a string, so the
  // effect only runs when the address really has to change.
  const current = selectionSearch(selection.itemId, selection.area).slice(1);
  let redirect: string | undefined;
  if (selection.itemId === undefined) redirect = filtered[0] && searchFor(filtered[0]);
  else if (selected && searchFor(selected, selection.area) !== current) redirect = searchFor(selected, selection.area);

  useEffect(() => {
    if (redirect !== undefined) setParams(redirect, { replace: true });
  }, [redirect, setParams]);

  // Opening a news item or assignment marks it read, once per opened item
  const openedArticleId = selected && selected.type !== 'hint' && readState ? selected.id : undefined;
  useEffect(() => {
    if (openedArticleId !== undefined) void markRead(openedArticleId);
    // markRead changes with every poll of the read state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openedArticleId]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <IntelTopBar nextHint={nextHint === '…' ? undefined : nextHint} />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[290px] shrink-0 flex-col border-r" aria-label="Overzicht">
          <ErrorBoundary name="De lijst" variant="inline" className="p-3">
            <div className="flex flex-col gap-2 border-b p-3">
              <IntelFilters filter={filter} counts={counts} onChange={setFilter} />
            </div>
            <IntelList
              items={filtered}
              selectedId={selected?.id}
              now={now}
              presence={presence}
              selfId={selfId}
              loading={articles === undefined}
              onSelect={(item) => setParams(searchFor(item, selection.area), { replace: false })}
            />
          </ErrorBoundary>
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto bg-muted/30">
          <ErrorBoundary name="Dit bericht" variant="inline" className="p-8">
            {selected ? (
              <IntelReader item={selected} area={selected.type === 'hint' ? selection.area : undefined} />
            ) : (
              <p className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">Kies links een hint, opdracht of nieuwsbericht.</p>
            )}
          </ErrorBoundary>
        </main>
        <aside className="w-[360px] shrink-0 overflow-y-auto border-l" aria-label="Details">
          <ErrorBoundary name="Dit paneel" variant="inline" className="p-4">
            <p className="p-4 text-sm text-muted-foreground">Kies een item</p>
          </ErrorBoundary>
        </aside>
      </div>
    </div>
  );
}
