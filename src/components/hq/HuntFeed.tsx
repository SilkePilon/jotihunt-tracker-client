import { useState } from 'react';
import { useHunts } from '@/hooks/hunts.hook';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import useInterval from '@/hooks/utils/interval.hook';
import HuntStatusBadge from '@/components/hunts/HuntStatusBadge';
import { formatHuntTime, huntListItems, totalPoints } from '@/lib/hunt-reports';
import { capitalizeFirstLetter } from '@/lib/utils';

const FEED_SIZE = 6;

export default function HuntFeed() {
  const { reports } = useHuntReports();
  const { hunts } = useHunts();
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), 1000);
  const items = huntListItems(reports, hunts);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">Hunts</h2>
        <span className="text-sm font-semibold">
          {items.length} hunts · {totalPoints(items)} pt
        </span>
      </div>
      {(reports ?? []).slice(0, FEED_SIZE).map((report) => (
        <div key={report._id} className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate">
            <strong>{capitalizeFirstLetter(report.area)}</strong> · {formatHuntTime(report.huntTime)} · {report.reportedByName}
          </span>
          <HuntStatusBadge report={report} now={now} />
        </div>
      ))}
      {reports?.length === 0 && <p className="text-sm text-muted-foreground">Nog geen hunts.</p>}
    </div>
  );
}
