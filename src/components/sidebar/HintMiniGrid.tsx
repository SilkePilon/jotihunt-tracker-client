import { Fragment } from 'react';
import { ArrowRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHintBoard } from '@/hooks/hints.hook';
import useHintBoardStore from '@/stores/hint-board.store';
import { lastHintRows } from '@/lib/hints';
import { areaOptions, cn } from '@/lib/utils';
import { HintCell } from '@/types/HintCell';

const MINI_GRID_ROWS = 4;

const cellClass: Record<HintCell['status'], string> = {
  solved: 'bg-green-500',
  solving: 'bg-amber-400',
  open: 'bg-muted',
  none: 'border border-dashed border-muted-foreground/40',
};

const statusLabel: Record<HintCell['status'], string> = {
  solved: 'opgelost',
  solving: 'bezig',
  open: 'open',
  none: 'geen hint',
};

export default function HintMiniGrid() {
  const openBoard = useHintBoardStore((state) => state.openBoard);
  const { board } = useHintBoard();
  const rows = board ? lastHintRows(board, MINI_GRID_ROWS) : [];

  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nog geen hints</p>
      ) : (
        <div className="grid grid-cols-[2.5rem_repeat(9,1fr)] items-center gap-0.5 text-[10px]">
          <span />
          {areaOptions.map((area) => (
            <span key={area.value} className="text-center font-semibold">
              {area.label.charAt(0)}
            </span>
          ))}
          {rows.map((row) => (
            <Fragment key={row.article.id}>
              <span className="font-mono text-muted-foreground">
                {new Date(row.article.publishAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {areaOptions.map((area) => {
                const cell = row.cells[area.value];
                if (!cell) return <span key={area.value} className="h-6 md:h-4" />;
                const label = `${area.label} · ${statusLabel[cell.status]}`;
                return (
                  <button
                    key={area.value}
                    type="button"
                    title={label}
                    aria-label={label}
                    onClick={() => openBoard({ articleId: row.article.id, area: area.value })}
                    className={cn('h-6 cursor-pointer rounded-sm hover:ring-2 hover:ring-primary/50 md:h-4', cellClass[cell.status])}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      )}
      <Button variant="outline" size="sm" onClick={() => openBoard()}>
        Open hintbord <ArrowRightIcon />
      </Button>
    </div>
  );
}
