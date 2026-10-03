import { currentHuntStatus, huntStatusText, isReading } from '@/lib/hunt-reports';
import { cn, getColorFromArea } from '@/lib/utils';
import type { HuntReport } from '@/types/HuntReport';
import HuntCodeText, { DuplicateMark, HuntTimeText } from './HuntCodeText';

type RowTone = HuntReport['status'] | 'reading';

/** Card colour per status, used for the border, tint and stripes; text colour for the status label. */
const TONES: Record<RowTone, { color: string; text: string }> = {
  reading: { color: '#a1a1aa', text: 'text-muted-foreground' },
  to_submit: { color: '#f59e0b', text: 'text-amber-700 dark:text-amber-300' },
  overdue: { color: '#ef4444', text: 'text-red-700 dark:text-red-300' },
  submitted: { color: '#3b82f6', text: 'text-blue-700 dark:text-blue-300' },
  judged: { color: '#22c55e', text: 'text-green-700 dark:text-green-400' },
};

/** Thin diagonal stripes in the status colour, faded out towards the code on the left. */
const STRIPES: React.CSSProperties = {
  backgroundImage: 'repeating-linear-gradient(-55deg, color-mix(in oklab, var(--tone) 22%, transparent) 0 2px, transparent 2px 8px)',
  maskImage: 'linear-gradient(90deg, transparent 25%, black 75%)',
};

/** Card for one hunt report: area dot, code, time and status on a striped background in the status colour; click opens the details. */
export default function HuntReportRow({ report, now, onSelect }: { report: HuntReport; now: number; onSelect?: () => void }) {
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      if (event.key === ' ') event.preventDefault();
      onSelect?.();
    }
  }

  // While the photo is being read there is no real hunt time yet, so no status either (the code shows "Wordt gelezen…")
  const reading = isReading(report);
  const tone = TONES[reading ? 'reading' : currentHuntStatus(report, now)];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border px-3 py-2 text-xs',
        onSelect && 'cursor-pointer transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-ring',
      )}
      style={
        {
          '--tone': tone.color,
          borderColor: 'color-mix(in oklab, var(--tone) 40%, transparent)',
          backgroundColor: 'color-mix(in oklab, var(--tone) 5%, var(--card))',
        } as React.CSSProperties
      }
      onClick={onSelect}
      onKeyDown={onSelect ? handleKeyDown : undefined}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <span className="pointer-events-none absolute inset-0" style={STRIPES} aria-hidden />
      <div className="relative flex items-center gap-2">
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(report.area) }} />
        <HuntCodeText report={report} />
        <DuplicateMark report={report} />
        <HuntTimeText report={report} className="text-muted-foreground" />
        {!reading && <span className={cn('ml-auto whitespace-nowrap font-semibold tabular-nums', tone.text)}>{huntStatusText(report, now)}</span>}
      </div>
    </div>
  );
}
