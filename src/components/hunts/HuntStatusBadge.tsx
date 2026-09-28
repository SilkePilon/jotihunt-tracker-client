import { Badge } from '@/components/ui/badge';
import { huntStatusLabel } from '@/lib/hunt-reports';
import { formatHintCountdown } from '@/lib/next-hint';
import type { HuntReport } from '@/types/HuntReport';

const STATUS_CLASSES: Record<HuntReport['status'], string> = {
  to_submit: 'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300',
  overdue: '',
  submitted: 'border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300',
  judged: 'border-green-200 bg-green-100 text-green-700 dark:border-green-500/30 dark:bg-green-500/15 dark:text-green-400',
};

function StatusBadge({ report, now }: { report: HuntReport; now: number }) {
  // The server status is from the last poll; flip to overdue locally when the deadline passes in between
  const overdue = report.status === 'to_submit' && new Date(report.deadline).getTime() < now;
  if (overdue || report.status === 'overdue') return <Badge variant="destructive">Te laat!</Badge>;
  let text = huntStatusLabel(report);
  if (report.status === 'to_submit') text += ` · ${formatHintCountdown(new Date(report.deadline).getTime() - now)}`;
  if (report.status === 'judged' && report.site) text += ` · ${report.site.points} pt`;
  return <Badge className={STATUS_CLASSES[report.status]}>{text}</Badge>;
}

/** Status of a report, plus "Controleren" when HQ should check the code/time read from the photo. */
export default function HuntStatusBadge({ report, now }: { report: HuntReport; now: number }) {
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1">
      {report.needsReview && (
        <Badge variant="outline" className="border-amber-400 text-amber-700 dark:border-amber-500/60 dark:text-amber-400" title="Code of tijd controleren">
          Controleren
        </Badge>
      )}
      <StatusBadge report={report} now={now} />
    </span>
  );
}
