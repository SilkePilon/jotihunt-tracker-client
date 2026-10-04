import { CheckIcon } from 'lucide-react';
import { areaOptions, capitalizeFirstLetter, cn, getColorFromArea } from '@/lib/utils';
import type { HintCell, HintCellStatus } from '@/types/HintCell';
import type { PresenceEntry } from '@/types/Intel';

const STATUS_LABEL: Record<HintCellStatus, string> = { solved: 'opgelost', solving: 'bezig', open: 'open', none: 'geen hint' };
const STATUS_CLASS: Record<HintCellStatus, string> = {
  solved: 'bg-green-500/20',
  solving: 'bg-amber-400/20',
  open: '',
  none: 'border-dashed opacity-60',
};

interface AreaStripProps {
  cells: HintCell[];
  /** The selected area */
  area: string;
  onSelect: (area: string) => void;
  /** The other users on this hint; an area someone is on gets a dot */
  presence: PresenceEntry[];
}

/** The areas of one hint as a row of buttons: how far each is, and which one the pane shows */
export default function AreaStrip({ cells, area, onSelect, presence }: AreaStripProps) {
  const ordered = areaOptions.flatMap(({ value }) => cells.filter((cell) => cell.area === value));
  if (ordered.length === 0) return null;

  return (
    <div role="group" aria-label="Deelgebieden" className={ordered.length === areaOptions.length ? 'grid grid-cols-9 gap-1' : 'flex gap-1'}>
      {ordered.map((cell) => {
        const label = `${capitalizeFirstLetter(cell.area)} · ${STATUS_LABEL[cell.status]}`;
        const selected = cell.area === area;
        return (
          <button
            key={cell.area}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={selected}
            onClick={() => onSelect(cell.area)}
            style={{ color: getColorFromArea(cell.area) }}
            className={cn(
              'relative flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-0.5 rounded-lg border py-1 text-xs font-bold outline-none transition-colors hover:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
              STATUS_CLASS[cell.status],
              selected && 'border-primary opacity-100 ring-1 ring-primary',
            )}
          >
            {cell.area.charAt(0).toUpperCase()}
            {cell.status === 'solved' && <CheckIcon className="size-3" aria-hidden />}
            {presence.some((entry) => entry.area === cell.area) && <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-amber-500" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
