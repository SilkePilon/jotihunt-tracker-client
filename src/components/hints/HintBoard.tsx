import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import useSound from 'use-sound';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { ArrowLeftIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import HintGrid from '@/components/hints/HintGrid';
import HintCellPanel from '@/components/hints/HintCellPanel';
import { useHintBoard } from '@/hooks/hints.hook';
import useInterval from '@/hooks/utils/interval.hook';
import useHintBoardStore from '@/stores/hint-board.store';
import hintAlert from '@/assets/audio/hint-alert.mp3';
import { User } from '@/types/User';

const LEGEND = [
  { label: 'open', className: 'bg-muted' },
  { label: 'bezig', className: 'bg-amber-200 dark:bg-amber-900' },
  { label: 'opgelost', className: 'bg-green-200 dark:bg-green-900' },
  { label: 'geen hint', className: 'border border-dashed' },
];

export function HintLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {LEGEND.map((item) => (
        <span key={item.label} className="flex items-center gap-1">
          <span className={`size-3 rounded ${item.className}`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Hint board contents: the grid of hints × fox teams and the answer panel of the selected cell. Desktop shows the
 * panel as a column next to the grid; phones show either the grid or the panel (with a back button).
 * Only mounted while the board is open, so the new-hint alert only sounds then (as the old full-screen page did).
 */
export default function HintBoard({ mobile, onShowOnMap }: { mobile: boolean; onShowOnMap: (lng: number, lat: number) => void }) {
  const user = useAuthUser<User>();
  const actions = useHintBoard();
  const { board, isLoading } = actions;
  const selected = useHintBoardStore((state) => state.selected);
  const setSelected = useHintBoardStore((state) => state.setSelected);
  const [now, setNow] = useState(() => Date.now());
  const [play] = useSound(hintAlert);
  const knownArticleIds = useRef<Set<number> | null>(null);

  useInterval(() => setNow(Date.now()), 1000);

  // Alert when a new hint article appears (not on first load)
  useEffect(() => {
    if (!board) return;
    const known = knownArticleIds.current;
    if (known === null) {
      knownArticleIds.current = new Set(board.articles.map((article) => article.id));
      return;
    }
    const fresh = board.articles.filter((article) => !known.has(article.id));
    if (fresh.length === 0) return;
    fresh.forEach((article) => known.add(article.id));
    play();
    toast.info('Nieuwe hint!', { description: fresh[0].title });
  }, [board, play]);

  const selectedArticle = board?.articles.find((article) => article.id === selected?.articleId);
  const selectedCell = board?.cells.find((cell) => cell.articleId === selected?.articleId && cell.area === selected?.area);
  const panelOpen = !!(selectedArticle && selectedCell);

  const panel = selectedArticle && selectedCell && (
    <HintCellPanel
      key={selectedCell._id}
      article={selectedArticle}
      cell={selectedCell}
      currentUserId={user?._id}
      isAdmin={user?.admin}
      actions={actions}
      onClose={() => setSelected(undefined)}
      onShowOnMap={onShowOnMap}
      className={mobile ? 'h-auto w-full border-l-0 p-0 pt-1' : undefined}
    />
  );

  if (mobile && panelOpen) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div>
          <Button variant="ghost" size="sm" onClick={() => setSelected(undefined)}>
            <ArrowLeftIcon data-icon="inline-start" />
            Terug
          </Button>
        </div>
        {panel}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="min-w-0 flex-1 overflow-auto">
        {isLoading && <p className="p-4 text-muted-foreground">Laden...</p>}
        {board && board.articles.length === 0 && <p className="p-4 text-muted-foreground">Nog geen hints gepubliceerd.</p>}
        {board && board.articles.length > 0 && <HintGrid articles={board.articles} cells={board.cells} now={now} selected={selected} onSelect={setSelected} />}
      </div>
      {!mobile && panel}
    </div>
  );
}
