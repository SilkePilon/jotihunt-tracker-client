import { Fragment, RefObject, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRightIcon } from 'lucide-react';
import { MapRef } from '@/components/Map';
import { Button } from '@/components/ui/button';
import { useHintBoard } from '@/hooks/hints.hook';
import { useIsMobile } from '@/hooks/media.hook';
import { formatClock } from '@/lib/format';
import { lastHintRows } from '@/lib/hints';
import { selectionSearch } from '@/lib/intel';
import { areaOptions, cn, getColorFromArea } from '@/lib/utils';
import useSidebarStore from '@/stores/sidebar.store';
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

/**
 * The last hints per area as a small grid. On desktop a cell opens that hint on the hints page; on phones it is the
 * only hint view: tapping a cell shows its state in one line and flies the map to a solved hint.
 */
export default function HintMiniGrid({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const setSheetSnap = useSidebarStore((state) => state.setSheetSnap);
  const [selected, setSelected] = useState<{ articleId: number; area: string } | null>(null);
  // Default (slow) polling: this is an overview, the hints page polls fast
  const { board } = useHintBoard();
  const rows = board ? lastHintRows(board, MINI_GRID_ROWS) : [];

  // Looked up in the live rows, so the line follows claims and answers by others
  const selectedRow = selected ? rows.find((row) => row.article.id === selected.articleId) : undefined;
  const selectedCell = selected ? selectedRow?.cells[selected.area] : undefined;
  const selectedArea = selected ? areaOptions.find((area) => area.value === selected.area) : undefined;

  function selectCell(articleId: number, area: string, cell: HintCell) {
    if (!isMobile) {
      navigate(`/hints${selectionSearch(articleId, area)}`);
      return;
    }
    setSelected({ articleId, area });
    if (cell.status === 'solved' && cell.answerLocation) {
      // Lower the sidebar sheet so the hint location is visible
      setSheetSnap('peek');
      mapRef.current?.flyTo({ center: cell.answerLocation, duration: 2000, zoom: 15 });
    }
  }

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
                {formatClock(row.article.publishAt)}
              </span>
              {areaOptions.map((area) => {
                const cell = row.cells[area.value];
                if (!cell) return <span key={area.value} className="h-6 md:h-4" />;
                const label = `${area.label} · ${statusLabel[cell.status]}`;
                const isSelected = isMobile && selected?.articleId === row.article.id && selected.area === area.value;
                return (
                  <button
                    key={area.value}
                    type="button"
                    title={label}
                    aria-label={label}
                    aria-pressed={isMobile ? isSelected : undefined}
                    onClick={() => selectCell(row.article.id, area.value, cell)}
                    className={cn(
                      'h-6 cursor-pointer rounded-[6px] hover:ring-2 hover:ring-primary/50 md:h-4',
                      cellClass[cell.status],
                      isSelected && 'ring-2 ring-primary hover:ring-primary',
                    )}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      )}
      {isMobile ? (
        <>
          {selectedRow && selectedCell && selectedArea && (
            <div className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(selectedArea.value) }} aria-hidden />
              <span className="shrink-0 font-semibold">
                {selectedArea.label} · {formatClock(selectedRow.article.publishAt)}
              </span>
              <CellSummary cell={selectedCell} />
            </div>
          )}
          <p className="text-center text-xs text-muted-foreground">Oplossen kan alleen op een laptop</p>
        </>
      ) : (
        <Button variant="outline" size="sm" onClick={() => navigate('/hints')}>
          Open hints <ArrowRightIcon />
        </Button>
      )}
    </div>
  );
}

/** What the one-line phone detail says about a cell: the answer, who is solving it, or its status. */
function CellSummary({ cell }: { cell: HintCell }) {
  switch (cell.status) {
    case 'solved':
      return <span className="min-w-0 truncate font-mono">{cell.answer ?? statusLabel.solved}</span>;
    case 'solving':
      return <span className="min-w-0 truncate">{cell.claimedBy ? `bezig · ${cell.claimedBy.name}` : 'bezig'}</span>;
    case 'open':
      return <span className="text-muted-foreground">open</span>;
    default:
      return <span className="text-muted-foreground">geen hint</span>;
  }
}
