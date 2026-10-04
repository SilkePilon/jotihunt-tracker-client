import { memo } from 'react';
import Countdown from '@/components/hints/detail/Countdown';
import type { HintBoardActions } from '@/hooks/hints.hook';
import { formatClock } from '@/lib/format';
import { othersOnItem } from '@/lib/intel';
import { capitalizeFirstLetter, getColorFromArea } from '@/lib/utils';
import type { IntelItem, PresenceEntry } from '@/types/Intel';
import AreaStrip from './AreaStrip';
import HintWorkflow from './HintWorkflow';
import PresenceBar from './PresenceBar';

interface HintPaneProps {
  item: IntelItem;
  /** The area of the hint the pane works on */
  area: string;
  onAreaChange: (area: string) => void;
  /** The memoised actions of `useHintBoard`, not the hook's whole return value (that is new on every render) */
  actions: HintBoardActions;
  presence: PresenceEntry[];
  selfId?: string;
  isAdmin?: boolean;
}

/**
 * The right pane for a hint: the areas of the hint, who else is on this one, and the claim → solve → check work on
 * the selected area. Render it with a key per cell, so the answer field starts fresh on another area.
 */
function HintPane({ item, area, onAreaChange, actions, presence, selfId, isAdmin }: HintPaneProps) {
  const cell = item.cells.find((entry) => entry.area === area);
  const here = othersOnItem(presence, item.id, selfId, area);
  // "bezig sinds" only when the one who claimed the cell is among those looking at it
  const claimedBy = cell?.status === 'solving' ? cell.claimedBy?._id : undefined;
  const claimedSince = claimedBy && here.some((entry) => entry.userId === claimedBy) ? cell?.claimedAt : undefined;

  return (
    <div className="flex flex-col gap-3 p-4">
      <AreaStrip cells={item.cells} area={area} onSelect={onAreaChange} presence={othersOnItem(presence, item.id, selfId)} />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(area) }} aria-hidden />
        <h2 className="text-base font-bold">{capitalizeFirstLetter(area)}</h2>
        <span className="text-sm text-muted-foreground">
          Hint <span className="tabular-nums">{formatClock(item.publishAt)}</span>
        </span>
        {cell && (cell.status === 'open' || cell.status === 'solving') && <Countdown publishAt={cell.publishAt} />}
      </div>
      <PresenceBar entries={here} claimedSince={claimedSince} />
      {cell ? <HintWorkflow cell={cell} actions={actions} selfId={selfId} isAdmin={isAdmin} /> : <p className="text-sm text-muted-foreground">Deze hint heeft geen vak voor dit deelgebied.</p>}
    </div>
  );
}

// Memoised: the page re-renders every second for its clock, and every prop here is stable between those renders
export default memo(HintPane);
