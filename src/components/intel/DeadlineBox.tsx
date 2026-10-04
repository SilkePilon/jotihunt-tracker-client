import { formatClock } from '@/lib/format';
import { ASSIGNMENT_STATUS_LABELS, deadlineLabel, deadlineTone, type DeadlineTone } from '@/lib/intel';
import { cn } from '@/lib/utils';
import type { AssignmentStatus } from '@/types/Intel';

const RED = 'border-red-500/40 text-red-700 dark:text-red-300';
const TONE: Record<DeadlineTone, string> = {
  late: RED,
  urgent: RED,
  soon: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
  done: 'border-green-500/40 text-green-700 dark:text-green-300',
  none: '',
};

const DAY: Intl.DateTimeFormatOptions = { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' };
const dayOf = (date: number | string) => new Date(date).toLocaleDateString('nl-NL', DAY);
const weekdayOf = (date: string) => new Date(date).toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'short' });

/** "15:30", or "zo 09:00" when that is not today (in Dutch time, like the clock) */
function deadlineClock(endTime: string, now: number): string {
  const clock = formatClock(endTime);
  return dayOf(endTime) === dayOf(now) ? clock : `${weekdayOf(endTime)} ${clock}`;
}

/** The deadline of an assignment with the time left, coloured by how pressing it is */
export default function DeadlineBox({ endTime, now, status }: { endTime: string; now: number; status: AssignmentStatus }) {
  const tone = deadlineTone(endTime, now, status);
  return (
    <div className={cn('flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2', TONE[tone])}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Deadline <span className="tabular-nums">{deadlineClock(endTime, now)}</span>
      </span>
      <span className="text-lg font-semibold tabular-nums">{tone === 'done' ? ASSIGNMENT_STATUS_LABELS[status] : deadlineLabel(endTime, now)}</span>
    </div>
  );
}
