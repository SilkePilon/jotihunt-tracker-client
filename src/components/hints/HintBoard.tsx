import { useState } from 'react';
import HintGrid from '@/components/hints/HintGrid';
import { useHintBoard } from '@/hooks/hints.hook';
import useInterval from '@/hooks/utils/interval.hook';
import useHintBoardStore from '@/stores/hint-board.store';

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
 * Hint board overview: the grid of hints × fox teams. Clicking a cell opens its detail dialog.
 */
export default function HintBoard() {
  const { board, isLoading } = useHintBoard({ live: true });
  const openCell = useHintBoardStore((state) => state.openCell);
  const [now, setNow] = useState(() => Date.now());

  useInterval(() => setNow(Date.now()), 1000);

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto">
      {isLoading && <p className="p-4 text-muted-foreground">Laden...</p>}
      {board && board.articles.length === 0 && <p className="p-4 text-muted-foreground">Nog geen hints gepubliceerd.</p>}
      {board && board.articles.length > 0 && <HintGrid articles={board.articles} cells={board.cells} now={now} onSelect={openCell} />}
    </div>
  );
}
