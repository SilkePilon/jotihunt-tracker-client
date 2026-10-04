import { memo, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatClock } from '@/lib/format';
import { ASSIGNMENT_STATUS_LABELS, deadlineLabel, deadlineTone, type DeadlineTone } from '@/lib/intel';
import { areaOptions, cn } from '@/lib/utils';
import type { HintCellStatus } from '@/types/HintCell';
import type { IntelItem, IntelType, PresenceEntry } from '@/types/Intel';
import PresenceAvatars from './PresenceAvatars';

const TYPE_ICON: Record<IntelType, { letter: string; className: string }> = {
  hint: { letter: 'H', className: 'bg-primary/20 text-primary' },
  assignment: { letter: 'O', className: 'bg-blue-500/15 text-blue-600 dark:text-blue-300' },
  news: { letter: 'N', className: 'bg-violet-500/15 text-violet-600 dark:text-violet-300' },
};

const CELL_BAR: Record<HintCellStatus, string> = {
  solved: 'bg-green-500',
  solving: 'bg-amber-400',
  open: 'bg-muted-foreground/25',
  none: 'border border-dashed border-muted-foreground/40',
};

const RED = 'border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-300';
const TONE_BADGE: Record<Exclude<DeadlineTone, 'none'>, string> = {
  late: RED,
  urgent: RED,
  soon: 'border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300',
  done: 'border-green-500/30 bg-green-500/15 text-green-700 dark:text-green-300',
};

const META = 'text-[11px] text-muted-foreground';

/** The text of an article without its markup; parsed in an inert document, so nothing loads or runs */
function plainText(html: string): string {
  return (new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Hint: a bar per area and how many are solved */
function HintLine({ item }: { item: IntelItem }) {
  const cells = areaOptions.flatMap(({ value }) => item.cells.filter((cell) => cell.area === value));
  if (cells.length === 0) return <span className={META}>…</span>;
  const total = cells.filter((cell) => cell.status !== 'none').length;
  const solved = cells.filter((cell) => cell.status === 'solved').length;
  return (
    <>
      <span className="flex shrink-0 gap-[3px]" aria-hidden>
        {cells.map((cell) => (
          <i key={cell.area} className={cn('block h-1.5 w-3.5 rounded-sm', CELL_BAR[cell.status])} />
        ))}
      </span>
      <span className={cn(META, 'truncate tabular-nums')}>
        {solved}/{total} opgelost
      </span>
    </>
  );
}

/** Assignment: the deadline (or how it ended), the points and who does it */
function AssignmentLine({ item, now }: { item: IntelItem; now?: number }) {
  const status = item.assignment?.status ?? 'open';
  // Without a deadline there is no clock to read: the tone is 'done' or 'none' whatever the time
  const tone = deadlineTone(item.endTime, now ?? 0, status);
  const label = tone === 'done' ? ASSIGNMENT_STATUS_LABELS[status].toLowerCase() : item.endTime && now !== undefined ? deadlineLabel(item.endTime, now) : null;
  const meta = [item.maxPoints !== undefined ? `max ${item.maxPoints} pt` : null, item.assignment?.owner?.name ?? 'niemand'].filter(Boolean).join(' · ');
  return (
    <>
      {label && tone !== 'none' && (
        <Badge variant="outline" className={cn('px-1.5 py-0 text-[10.5px] font-semibold tabular-nums', TONE_BADGE[tone])}>
          {label}
        </Badge>
      )}
      <span className={cn(META, 'truncate')}>{meta}</span>
    </>
  );
}

/** News: the first line of the summary, or the start of the text */
function NewsLine({ item }: { item: IntelItem }) {
  const text = useMemo(() => (item.summary ? item.summary.trim().split('\n')[0] : plainText(item.content).slice(0, 80)), [item.summary, item.content]);
  return <span className={cn(META, 'truncate')}>{text}</span>;
}

interface IntelListItemProps {
  item: IntelItem;
  selected: boolean;
  /** The current time, only for an assignment with a deadline: the other rows do not follow the clock */
  now?: number;
  /** The other users who have this item open */
  presence: PresenceEntry[];
  onSelect: (item: IntelItem) => void;
}

/**
 * One row of the list: a hint, an assignment or a news item with its state at a glance. Memoised: give it props that
 * keep their identity, so a row only renders again when something it shows changed.
 */
function IntelListItem({ item, selected, now, presence, onSelect }: IntelListItemProps) {
  const icon = TYPE_ICON[item.type];
  const unread = item.unread && item.type !== 'hint';

  return (
    <button
      type="button"
      aria-current={selected}
      onClick={() => onSelect(item)}
      className={cn(
        'flex w-full cursor-pointer gap-2.5 border-b px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset',
        selected && 'bg-muted shadow-[inset_2px_0_0_var(--primary)] hover:bg-muted',
      )}
    >
      <span className={cn('flex size-6.5 shrink-0 items-center justify-center rounded-lg text-xs font-bold', icon.className)} aria-hidden>
        {icon.letter}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-1.5">
          {unread && <span role="img" aria-label="Ongelezen" className="size-1.5 shrink-0 rounded-full bg-primary" />}
          <span className={cn('min-w-0 flex-1 truncate text-sm', unread ? 'font-bold' : 'font-semibold')}>{item.title}</span>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{formatClock(item.publishAt)}</span>
        </span>
        <span className="flex min-h-5 items-center gap-1.5">
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            {item.type === 'hint' && <HintLine item={item} />}
            {item.type === 'assignment' && <AssignmentLine item={item} now={now} />}
            {item.type === 'news' && <NewsLine item={item} />}
          </span>
          <PresenceAvatars entries={presence} />
        </span>
      </span>
    </button>
  );
}

export default memo(IntelListItem);
