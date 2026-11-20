import { Fragment, RefObject, useState } from 'react';
import { ArrowRightIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { MapRef } from '@/components/Map';
import { Button } from '@/components/ui/button';
import { useHintBoard } from '@/hooks/hints.hook';
import { useIsMobile } from '@/hooks/media.hook';
import { formatClock } from '@/lib/format';
import { lastHintRows } from '@/lib/hints';
import { areaOptions, cn, getColorFromArea } from '@/lib/utils';
import useIntelStore from '@/stores/intel.store';
import useSidebarStore from '@/stores/sidebar.store';
import { HintCell } from '@/types/HintCell';
import { TONAL_BUTTON } from '@/lib/tonal-button';
import { SWAP, SWAP_TRANSITION } from '@/lib/motion';
import { loadState } from '@/lib/load-state';
import { COARSE_HIT_AREA } from '@/lib/hit-area';
import LoadError from '@/components/LoadError';
import Reveal from '@/components/motion/Reveal';
import { Skeleton } from '@/components/ui/skeleton';

const MINI_GRID_ROWS = 4;

const cellClass: Record<HintCell['status'], string> = {
  solved: 'bg-fox-ok',
  open: 'bg-muted',
  none: 'border border-dashed border-muted-foreground/50',
};

const statusLabel: Record<HintCell['status'], string> = {
  solved: 'opgelost',
  open: 'open',
  none: 'geen hint',
};

/**
 * The last hints per area as a small grid. On desktop a cell opens that hint in the intel window; on phones it is the
 * only hint view: tapping a cell shows its state in one line and flies the map to a solved hint.
 */
export default function HintMiniGrid({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const isMobile = useIsMobile();
  const openIntel = useIntelStore((state) => state.openIntel);
  const setSheetSnap = useSidebarStore((state) => state.setSheetSnap);
  const [selected, setSelected] = useState<{ articleId: number; area: string } | null>(null);
  // Default (slow) polling: this is an overview, the intel window polls fast
  const { board, error, retry } = useHintBoard();
  const rows = board ? lastHintRows(board, MINI_GRID_ROWS) : [];
  const view = loadState(board, error);

  // Looked up in the live rows, so the line follows answers by others
  const selectedRow = selected ? rows.find((row) => row.article.id === selected.articleId) : undefined;
  const selectedCell = selected ? selectedRow?.cells[selected.area] : undefined;
  const selectedArea = selected ? areaOptions.find((area) => area.value === selected.area) : undefined;

  function selectCell(articleId: number, area: string, cell: HintCell) {
    if (!isMobile) {
      openIntel(articleId, area);
      return;
    }
    setSelected({ articleId, area });
    if (cell.status === 'solved' && cell.answerLocation) {
      // Lower the sidebar sheet to half: the hint location shows on the map and the answer line under the grid stays visible
      setSheetSnap('half');
      mapRef.current?.flyTo({ center: cell.answerLocation, duration: 2000, zoom: 15 });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence mode="wait" initial={false}>
      {view === 'loading' ? (
        <motion.div key="loading" {...SWAP} className="flex flex-col gap-0.5" aria-label="Hints laden" role="status">
          {Array.from({ length: MINI_GRID_ROWS + 1 }, (_, index) => (
            <Skeleton key={index} className="h-6 w-full rounded-(--radius-segment) desk:h-4" />
          ))}
        </motion.div>
      ) : view === 'error' ? (
        <motion.div key="error" {...SWAP}>
          <LoadError message="Hints konden niet worden geladen." onRetry={retry} />
        </motion.div>
      ) : rows.length === 0 ? (
        <motion.p key="empty" {...SWAP} className="text-xs text-muted-foreground">Nog geen hints</motion.p>
      ) : (
        <motion.div key="grid" {...SWAP} className="isolate grid grid-cols-[2.5rem_repeat(9,1fr)] items-center gap-0.5 text-xs desk:text-[10px]">
          <span />
          {areaOptions.map((area) => (
            <span key={area.value} className="text-center font-semibold">
              {area.label.charAt(0)}
            </span>
          ))}
          {rows.map((row) => (
            <Fragment key={row.article.id}>
              <span className="tabular-nums text-muted-foreground">
                {formatClock(row.article.publishAt)}
              </span>
              {areaOptions.map((area) => {
                const cell = row.cells[area.value];
                if (!cell) return <span key={area.value} className="h-6 desk:h-4" />;
                const label = `Hint ${formatClock(row.article.publishAt)}, ${area.label} · ${statusLabel[cell.status]}`;
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
                      // Keyboard focus: a thicker ring in the focus colour, distinct from hover (2px primary/50) and selected (2px)
                      'flex h-6 cursor-pointer items-center justify-center rounded-(--radius-segment) outline-none transition-colors duration-200 hover:ring-2 hover:ring-primary/50 focus-visible:ring-[3px] focus-visible:ring-ring desk:h-4',
                      COARSE_HIT_AREA,
                      cellClass[cell.status],
                      isSelected && 'ring-2 ring-ring hover:ring-ring',
                    )}
                  >
                    {/* No hint for this area: a dash, so it can't be read as an open (grey) cell */}
                    <AnimatePresence initial={false}>
                      {cell.status === 'none' && <motion.span key="none" initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: 1, scaleX: 1 }} exit={{ opacity: 0, scaleX: 0 }} transition={SWAP_TRANSITION} className="h-px w-2 rounded-full bg-muted-foreground/70" aria-hidden />}
                    </AnimatePresence>
                  </button>
                );
              })}
            </Fragment>
          ))}
        </motion.div>
      )}
      </AnimatePresence>
      {isMobile ? (
        <>
          {/* Unfolds under the grid on the first tap; another cell swaps the line's content (keyed on the cell). The
              always-mounted status region reads the answer out; -mt-2 cancels the column gap while it is folded and
              the line's own pt-2 brings it back as it unfolds */}
          <div role="status" className="-mt-2">
            <Reveal>
              {selectedRow && selectedCell && selectedArea && (
                <div className="pt-2">
                  <div className="overflow-hidden rounded-xl bg-beheer-row px-2.5 py-1.5 text-xs">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div key={`${selectedRow.article.id}-${selectedArea.value}`} {...SWAP} className="flex items-center gap-2">
                        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(selectedArea.value) }} aria-hidden />
                        <span className="shrink-0 font-semibold">
                          {selectedArea.label} · {formatClock(selectedRow.article.publishAt)}
                        </span>
                        <CellSummary cell={selectedCell} />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </Reveal>
          </div>
          <p className="text-center text-xs text-muted-foreground">Oplossen kan alleen op een laptop</p>
        </>
      ) : (
        <Button variant="ghost" size="sm" className={TONAL_BUTTON} onClick={() => openIntel()}>Open Intel <ArrowRightIcon /></Button>
      )}
    </div>
  );
}

/** What the one-line phone detail says about a cell: the answer or its status. */
function CellSummary({ cell }: { cell: HintCell }) {
  switch (cell.status) {
    case 'solved':
      return <span className="min-w-0 truncate font-mono">{cell.answer ?? statusLabel.solved}</span>;
    case 'open':
      return <span className="text-muted-foreground">open</span>;
    default:
      return <span className="text-muted-foreground">geen hint</span>;
  }
}
