import { currentHuntStatus, huntStatusSentence, huntTimelineStatus, isReading } from '@/lib/hunt-reports';
import { capitalizeFirstLetter, cn, getColorFromArea } from '@/lib/utils';
import type { HuntReport } from '@/types/HuntReport';
import HuntCodeText, { DuplicateMark, HuntTimeText } from './HuntCodeText';

/** Text colour of the right-hand status, per (current) status. */
const STATUS_TEXT: Record<HuntReport['status'], string> = {
  to_submit: 'text-amber-700 dark:text-amber-300',
  overdue: 'text-red-700 dark:text-red-300',
  submitted: 'text-blue-700 dark:text-blue-300',
  judged: 'text-green-700 dark:text-green-400',
};

/** One hunt on the sidebar timeline: time left, area dot on the line, code with a status sentence, status right; click opens the details. */
export default function HuntTimelineItem({ report, now, last, onSelect }: { report: HuntReport; now: number; last: boolean; onSelect: () => void }) {
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      if (event.key === ' ') event.preventDefault();
      onSelect();
    }
  }

  // While the photo is being read there is no real hunt time yet, so no status either (the code shows "Wordt gelezen…")
  const reading = isReading(report);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className="grid cursor-pointer grid-cols-[2.75rem_0.75rem_1fr_auto] items-start gap-x-2 rounded-md py-1.5 pr-1 text-xs outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <HuntTimeText report={report} className="text-right text-muted-foreground tabular-nums" />
      <span className="relative flex h-full justify-center" aria-hidden>
        {/* Runs on to the next dot; after the last dot it fades out, so a single hunt still reads as a timeline */}
        <span className={cn('absolute top-3 w-0.5', last ? 'bottom-0 bg-linear-to-b from-border to-transparent' : '-bottom-3 bg-border')} />
        <span className="relative mt-0.5 size-2.5 rounded-full ring-[3px] ring-card" style={{ backgroundColor: getColorFromArea(report.area) }} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="flex min-w-0 items-center gap-1">
          <HuntCodeText report={report} />
          <DuplicateMark report={report} />
        </span>
        <span className="truncate text-muted-foreground">
          {capitalizeFirstLetter(report.area)} · {huntStatusSentence(report, now)}
        </span>
      </span>
      {!reading && <span className={cn('whitespace-nowrap font-semibold tabular-nums', currentHuntStatus(report, now) === 'judged' && !report.site?.points ? 'text-muted-foreground' : STATUS_TEXT[currentHuntStatus(report, now)])}>{huntTimelineStatus(report, now)}</span>}
    </div>
  );
}
