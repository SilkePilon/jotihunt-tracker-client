import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAuthImage } from '@/hooks/auth-image.hook';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { useInViewOnce } from '@/hooks/in-view.hook';
import { useIsMobile } from '@/hooks/media.hook';
import { useHunts } from '@/hooks/hunts.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { keepOpenWhileEditing } from '@/lib/inline-edit';
import { formatHuntTimeSafe, hasLiveCountdown, huntListItems } from '@/lib/hunt-reports';
import { areaOptions, capitalizeFirstLetter, cn, getColorFromArea } from '@/lib/utils';
import type { HuntListItem, HuntReport } from '@/types/HuntReport';
import HuntCodeText, { DuplicateMark, HuntTimeText } from './HuntCodeText';
import HuntDetail from './HuntDetail';

import HuntStatusBadge from './HuntStatusBadge';

type Filter = 'all' | 'pending' | 'submitted' | 'judged';

/** Rows rendered at first (and added per "Meer laden"), so a long list opens quickly. */
const PAGE_SIZE = 200;

function matchesFilter(item: HuntListItem, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (item.source === 'website') return filter === 'judged';
  const status = item.report.status;
  if (filter === 'pending') return status === 'to_submit' || status === 'overdue';
  return status === filter;
}

const itemArea = (item: HuntListItem) => (item.source === 'app' ? item.report.area : item.hunt.area).trim().toLowerCase();
const itemPoints = (item: HuntListItem) => (item.source === 'app' ? (item.report.site?.points ?? 0) : item.hunt.points);

/** Photo thumbnail, only fetched once the row scrolls into view (each photo is a full-size download). */
function HuntThumb({ report }: { report: HuntReport }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInViewOnce(ref);
  const photo = useAuthImage(inView ? report.photoUrl : null);
  return photo ? <img src={photo} alt="" className="size-8 rounded object-cover" /> : <div ref={ref} className="size-8 rounded bg-muted" />;
}

/** Status badge with its own clock: only rows with a running "Te versturen" countdown re-render every second. */
function LiveHuntStatusBadge({ report }: { report: HuntReport }) {
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), hasLiveCountdown(report, now) ? 1000 : null);
  return <HuntStatusBadge report={report} now={now} />;
}

function Totals({ items }: { items: HuntListItem[] }) {
  const areas = areaOptions
    .map((option) => {
      const inArea = items.filter((item) => itemArea(item) === option.value);
      return { ...option, count: inArea.length, points: inArea.reduce((sum, item) => sum + itemPoints(item), 0) };
    })
    .filter((area) => area.count > 0);
  const points = items.reduce((sum, item) => sum + itemPoints(item), 0);

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {areas.map((area) => (
        <span key={area.value} className="inline-flex items-center gap-1.5 rounded-badge border px-2 py-0.5">
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(area.value) }} />
          {area.label} {area.count} · {area.points} pt
        </span>
      ))}
      <span className="ml-auto font-medium">
        Totaal: {items.length} hunts · {points} pt
      </span>
    </div>
  );
}

function AreaCell({ area }: { area: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(area) }} />
      <span className="max-md:sr-only">{capitalizeFirstLetter(area)}</span>
    </span>
  );
}

interface HuntRowProps {
  item: HuntListItem;
  /** Phones show no photo column (and fetch no photos) */
  showThumb: boolean;
  onSelect: (id: string) => void;
}

const HuntRow = memo(function HuntRow({ item, showThumb, onSelect }: HuntRowProps) {
  if (item.source === 'website') {
    const { hunt } = item;
    return (
      <TableRow>
        <TableCell className="text-muted-foreground max-md:hidden">–</TableCell>
        <TableCell>
          <AreaCell area={hunt.area} />
        </TableCell>
        <TableCell className="font-mono">{hunt.huntCode}</TableCell>
        <TableCell>{formatHuntTimeSafe(hunt.huntTime)}</TableCell>
        <TableCell className="text-muted-foreground max-md:hidden">jotihunt.nl</TableCell>
        <TableCell>
          <Badge variant="outline">{hunt.status}</Badge>
        </TableCell>
        <TableCell className="text-right">{hunt.points}</TableCell>
      </TableRow>
    );
  }

  const { report } = item;
  function handleKeyDown(event: React.KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(report._id);
    }
  }

  return (
    <TableRow className="cursor-pointer" role="button" tabIndex={0} onClick={() => onSelect(report._id)} onKeyDown={handleKeyDown}>
      <TableCell className="max-md:hidden">{showThumb && <HuntThumb report={report} />}</TableCell>
      <TableCell>
        <AreaCell area={report.area} />
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1">
          <HuntCodeText report={report} />
          <DuplicateMark report={report} />
        </span>
      </TableCell>
      <TableCell>
        <HuntTimeText report={report} />
      </TableCell>
      <TableCell className="max-md:hidden">{report.reportedByName}</TableCell>
      <TableCell>
        <LiveHuntStatusBadge report={report} />
      </TableCell>
      <TableCell className="text-right">{report.site ? report.site.points : '–'}</TableCell>
    </TableRow>
  );
});

/** Every hunt (own reports plus website-only hunts) with per-area totals, a status filter and a detail view per report. */
export default function AllHuntsDialog({ open, onOpenChange, initialReportId }: { open: boolean; onOpenChange: (open: boolean) => void; initialReportId?: string }) {
  const { reports } = useHuntReports();
  const { hunts } = useHunts();
  const [filter, setFilter] = useState<Filter>('all');
  const [detailId, setDetailId] = useState<string | undefined>(open ? initialReportId : undefined);
  const [prevOpen, setPrevOpen] = useState(open);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const isMobile = useIsMobile();
  const [now, setNow] = useState(() => Date.now());
  const detail = detailId ? reports?.find((report) => report._id === detailId) : undefined;
  // Only the detail needs the dialog-wide clock; list rows tick on their own (LiveHuntStatusBadge)
  useInterval(() => setNow(Date.now()), open && detail ? 1000 : null);

  // Opening the dialog shows the requested report (or the list)
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDetailId(initialReportId);
      // The clock only runs while a detail is shown; don't show it with the time of the last opening
      setNow(() => Date.now());
      setLimit(PAGE_SIZE);
    }
  }

  const selectReport = useCallback((id: string) => {
    setNow(Date.now());
    setDetailId(id);
  }, []);

  function changeFilter(next: Filter) {
    setFilter(next);
    setLimit(PAGE_SIZE);
  }

  const items = useMemo(() => huntListItems(reports, hunts), [reports, hunts]);
  const shown = useMemo(() => items.filter((item) => matchesFilter(item, filter)), [items, filter]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onEscapeKeyDown={keepOpenWhileEditing}
        showCloseButton={!detail}
        className={cn(
          'flex max-h-[92dvh] flex-col gap-3 sm:max-w-4xl max-md:h-dvh max-md:max-h-dvh max-md:max-w-none max-md:rounded-none',
          // The detail's photo runs to the dialog edges and brings its own back/close buttons
          detail && 'gap-0 overflow-hidden p-0',
        )}
      >
        <DialogHeader className={cn(detail && 'sr-only')}>
          <DialogTitle>Alle hunts</DialogTitle>
          <DialogDescription className="sr-only">Alle geregistreerde hunts en hunts van jotihunt.nl.</DialogDescription>
        </DialogHeader>

        {detail ? (
          <HuntDetail key={detail._id} report={detail} now={now} onBack={() => setDetailId(undefined)} onClose={() => onOpenChange(false)} />
        ) : (
          <>
            <Totals items={items} />
            <ToggleGroup type="single" variant="outline" size="sm" aria-label="Filter" className="max-md:w-full" value={filter} onValueChange={(next) => next && changeFilter(next as Filter)}>
              <ToggleGroupItem value="all" className="max-md:flex-auto max-md:px-2 max-md:text-xs">
                Alles
              </ToggleGroupItem>
              <ToggleGroupItem value="pending" className="max-md:flex-auto max-md:px-2 max-md:text-xs">
                Te versturen
              </ToggleGroupItem>
              <ToggleGroupItem value="submitted" className="max-md:flex-auto max-md:px-2 max-md:text-xs">
                Ingestuurd
              </ToggleGroupItem>
              <ToggleGroupItem value="judged" className="max-md:flex-auto max-md:px-2 max-md:text-xs">
                Beoordeeld
              </ToggleGroupItem>
            </ToggleGroup>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {shown.length ? (
                <>
                  <Table className="max-md:text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="max-md:hidden">Foto</TableHead>
                        <TableHead>
                          <span className="max-md:sr-only">Deelgebied</span>
                        </TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Tijd</TableHead>
                        <TableHead className="max-md:hidden">Gemeld door</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Punten</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shown.slice(0, limit).map((item) => (
                        <HuntRow key={item.source === 'app' ? item.report._id : `site-${item.hunt._id}`} item={item} showThumb={!isMobile} onSelect={selectReport} />
                      ))}
                    </TableBody>
                  </Table>
                  {shown.length > limit && (
                    <div className="flex justify-center py-3">
                      <Button variant="outline" size="sm" onClick={() => setLimit((current) => current + PAGE_SIZE)}>
                        Meer laden ({shown.length - limit} over)
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Geen hunts in deze lijst.</p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
