import { Loader2Icon, TriangleAlertIcon } from 'lucide-react';
import { huntTimeLabel, isReading } from '@/lib/hunt-reports';
import { cn } from '@/lib/utils';
import type { HuntReport } from '@/types/HuntReport';
import Concealed from './Concealed';

/**
 * The hunt code of a report: the known code in mono (blurred while concealed), "Wordt gelezen…" while the server
 * reads the photo, or "Onbekend" when reading found nothing.
 */
export default function HuntCodeText({ report, concealed, className }: { report: HuntReport; concealed: boolean; className?: string }) {
  if (report.huntCode) {
    return (
      <Concealed concealed={concealed}>
        <span className={cn('truncate font-mono font-medium', className)}>{report.huntCode}</span>
      </Concealed>
    );
  }
  if (isReading(report)) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-muted-foreground">
        <Loader2Icon className="size-3 shrink-0 animate-spin" aria-hidden />
        Wordt gelezen…
      </span>
    );
  }
  return <span className="text-muted-foreground">Onbekend</span>;
}

/** The hunt time; "±HH:MM" (the upload time) while the time on the photo is not known yet. */
export function HuntTimeText({ report, className }: { report: HuntReport; className?: string }) {
  return (
    <span className={className} title={report.huntTimeKnown ? undefined : 'Tijd nog niet gelezen'}>
      {huntTimeLabel(report)}
    </span>
  );
}

/** Small warning sign for list rows when an older report has the same code. */
export function DuplicateMark({ report }: { report: HuntReport }) {
  if (!report.duplicateOf) return null;
  const text = `Zelfde code als hunt van ${report.duplicateOf.reportedByName}`;
  return (
    <span className="shrink-0 text-amber-600 dark:text-amber-500" title={text}>
      <TriangleAlertIcon className="size-3.5" aria-hidden />
      <span className="sr-only">{text}</span>
    </span>
  );
}
