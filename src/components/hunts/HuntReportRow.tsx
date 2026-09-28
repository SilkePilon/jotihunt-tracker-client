import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { formatHuntTime } from '@/lib/hunt-reports';
import { getColorFromArea } from '@/lib/utils';
import type { HuntReport } from '@/types/HuntReport';
import HuntStatusBadge from './HuntStatusBadge';

/** Compact row for one hunt report: area dot, code, time, status, and (while pending) quick actions. */
export default function HuntReportRow({ report, now, onSelect }: { report: HuntReport; now: number; onSelect?: () => void }) {
  const { setSubmitted } = useHuntReports();
  const pending = report.status === 'to_submit' || report.status === 'overdue';

  async function markSubmitted() {
    try {
      await setSubmitted(report._id, true);
      toast.success('Gemarkeerd als ingestuurd', {
        action: { label: 'Ongedaan maken', onClick: () => void setSubmitted(report._id, false) },
      });
    } catch {
      toast.error('Opslaan is mislukt');
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(report.huntCode);
      toast('Code gekopieerd');
    } catch {
      toast.error('Kopiëren mislukt');
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      if (event.key === ' ') event.preventDefault();
      onSelect?.();
    }
  }

  return (
    <div
      className={onSelect ? 'cursor-pointer rounded-md px-1 py-1 text-xs hover:bg-accent' : 'px-1 py-1 text-xs'}
      onClick={onSelect}
      onKeyDown={onSelect ? handleKeyDown : undefined}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <div className="flex items-center gap-2">
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(report.area) }} />
        <span className="font-mono font-medium">{report.huntCode}</span>
        <span className="text-muted-foreground">{formatHuntTime(report.huntTime)}</span>
        {report.kind === 'tegenhunt' && <span className="text-muted-foreground">Tegenhunt</span>}
        <span className="ml-auto">
          <HuntStatusBadge report={report} now={now} />
        </span>
      </div>
      {pending && (
        <div className="mt-1 flex gap-1.5" onClick={(event) => event.stopPropagation()}>
          <Button type="button" variant="outline" size="xs" onClick={copyCode}>
            Kopieer code
          </Button>
          <Button type="button" variant="outline" size="xs" onClick={() => void markSubmitted()}>
            Ingestuurd
          </Button>
        </div>
      )}
    </div>
  );
}
