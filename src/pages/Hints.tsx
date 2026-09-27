import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import useSound from 'use-sound';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { ArrowLeftIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import HintGrid, { CellKey } from '@/components/hints/HintGrid';
import HintCellPanel from '@/components/hints/HintCellPanel';
import { useHintBoard } from '@/hooks/hints.hook';
import { useOutlet } from '@/hooks/outlet.hook';
import useInterval from '@/hooks/utils/interval.hook';
import hintAlert from '@/assets/audio/hint-alert.mp3';
import { User } from '@/types/User';

export default function Hints() {
  const navigate = useNavigate();
  const { mapRef } = useOutlet();
  const user = useAuthUser<User>();
  const actions = useHintBoard();
  const { board, isLoading } = actions;
  const [searchParams] = useSearchParams();
  // Preselect a cell when opened from the sidebar mini grid (/hints?article=<id>&area=<area>)
  const [selected, setSelected] = useState<CellKey | undefined>(() => {
    const articleId = Number(searchParams.get('article'));
    const area = searchParams.get('area');
    return articleId && area ? { articleId, area } : undefined;
  });
  const [now, setNow] = useState(() => Date.now());
  const [play] = useSound(hintAlert);
  const knownArticleIds = useRef<Set<number> | null>(null);

  useInterval(() => setNow(Date.now()), 1000);

  // Alert when a new hint article appears (not on first load)
  useEffect(() => {
    if (!board) return;
    if (knownArticleIds.current === null) {
      knownArticleIds.current = new Set(board.articles.map((article) => article.id));
      return;
    }
    const fresh = board.articles.filter((article) => !knownArticleIds.current!.has(article.id));
    if (fresh.length === 0) return;
    fresh.forEach((article) => knownArticleIds.current!.add(article.id));
    play();
    toast.info('Nieuwe hint!', { description: fresh[0].title });
  }, [board, play]);

  const selectedArticle = board?.articles.find((article) => article.id === selected?.articleId);
  const selectedCell = board?.cells.find((cell) => cell.articleId === selected?.articleId && cell.area === selected?.area);

  function showOnMap(lng: number, lat: number) {
    navigate('/');
    mapRef.current?.flyTo({ center: [lng, lat], duration: 2000, zoom: 15 });
  }

  return (
    <div className="absolute inset-0 z-40 flex bg-background">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b p-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Terug naar kaart">
            <ArrowLeftIcon />
          </Button>
          <h1 className="text-2xl font-bold">Hints</h1>
          <div className="ml-auto flex gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="size-3 rounded bg-muted" />
              open
            </span>
            <span className="flex items-center gap-1">
              <span className="size-3 rounded bg-amber-200 dark:bg-amber-900" />
              bezig
            </span>
            <span className="flex items-center gap-1">
              <span className="size-3 rounded bg-green-200 dark:bg-green-900" />
              opgelost
            </span>
            <span className="flex items-center gap-1">
              <span className="size-3 rounded border border-dashed" />
              geen hint
            </span>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-2">
          {isLoading && <p className="p-4 text-muted-foreground">Laden...</p>}
          {board && board.articles.length === 0 && <p className="p-4 text-muted-foreground">Nog geen hints gepubliceerd.</p>}
          {board && board.articles.length > 0 && (
            <HintGrid articles={board.articles} cells={board.cells} now={now} selected={selected} onSelect={setSelected} />
          )}
        </div>
      </div>
      {selectedArticle && selectedCell && (
        <HintCellPanel
          key={selectedCell._id}
          article={selectedArticle}
          cell={selectedCell}
          currentUserId={user?._id}
          isAdmin={user?.admin}
          actions={actions}
          onClose={() => setSelected(undefined)}
          onShowOnMap={showOnMap}
        />
      )}
    </div>
  );
}
