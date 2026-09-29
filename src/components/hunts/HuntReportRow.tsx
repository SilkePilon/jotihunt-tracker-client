import { isConcealed } from '@/lib/hunt-reports';
import { getColorFromArea } from '@/lib/utils';
import type { HuntReport } from '@/types/HuntReport';
import HuntCodeText, { DuplicateMark, HuntTimeText } from './HuntCodeText';
import HuntStatusBadge from './HuntStatusBadge';

/** Compact row for one hunt report: area dot, code, time and status; click opens the details. */
export default function HuntReportRow({ report, now, onSelect }: { report: HuntReport; now: number; onSelect?: () => void }) {
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
        <HuntCodeText report={report} concealed={isConcealed(report, now)} />
        <DuplicateMark report={report} />
        <HuntTimeText report={report} className="text-muted-foreground" />
        <span className="ml-auto">
          <HuntStatusBadge report={report} now={now} />
        </span>
      </div>
    </div>
  );
}
