import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAuthImage } from '@/hooks/auth-image.hook';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { useHunts } from '@/hooks/hunts.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { formatHuntTime, formatHuntTimeSafe, huntListItems } from '@/lib/hunt-reports';
import { areaOptions, capitalizeFirstLetter, getColorFromArea } from '@/lib/utils';
import type { HuntListItem, HuntReport } from '@/types/HuntReport';
import HuntDetail from './HuntDetail';
import HuntStatusBadge from './HuntStatusBadge';

type Filter = 'all' | 'pending' | 'submitted' | 'judged';

function matchesFilter(item: HuntListItem, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (item.source === 'website') return filter === 'judged';
  const status = item.report.status;
  if (filter === 'pending') return status === 'to_submit' || status === 'overdue';
  return status === filter;
}

const itemArea = (item: HuntListItem) => (item.source === 'app' ? item.report.area : item.hunt.area).trim().toLowerCase();
const itemPoints = (item: HuntListItem) => (item.source === 'app' ? (item.report.site?.points ?? 0) : item.hunt.points);

function HuntThumb({ report }: { report: HuntReport }) {
  const photo = useAuthImage(report.photoUrl);
  return photo ? <img src={photo} alt="" className="size-8 rounded object-cover" /> : <div className="size-8 rounded bg-muted" />;
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
        <span key={area.value} className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5">
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

function HuntRow({ item, now, onSelect }: { item: HuntListItem; now: number; onSelect: (id: string) => void }) {
  if (item.source === 'website') {
    const { hunt } = item;
    return (
      <TableRow>
        <TableCell className="text-muted-foreground max-md:hidden">–</TableCell>
        <TableCell>
          <AreaCell area={hunt.area} />
        </TableCell>
        <TableCell className="font-mono">{hunt.huntCode}</TableCell>
        <TableCell className="text-muted-foreground max-md:hidden">–</TableCell>
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
      <TableCell className="max-md:hidden">
        <HuntThumb report={report} />
      </TableCell>
      <TableCell>
        <AreaCell area={report.area} />
      </TableCell>
      <TableCell className="font-mono">{report.huntCode}</TableCell>
      <TableCell className="max-md:hidden">{capitalizeFirstLetter(report.kind)}</TableCell>
      <TableCell>{formatHuntTime(report.huntTime)}</TableCell>
      <TableCell className="max-md:hidden">{report.reportedByName}</TableCell>
      <TableCell>
        <HuntStatusBadge report={report} now={now} />
      </TableCell>
      <TableCell className="text-right">{report.site ? report.site.points : '–'}</TableCell>
    </TableRow>
  );
}

/** Every hunt (own reports plus website-only hunts) with per-area totals, a status filter and a detail view per report. */
export default function AllHuntsDialog({ open, onOpenChange, initialReportId }: { open: boolean; onOpenChange: (open: boolean) => void; initialReportId?: string }) {
  const { reports } = useHuntReports();
  const { hunts } = useHunts();
  const [filter, setFilter] = useState<Filter>('all');
  const [detailId, setDetailId] = useState<string | undefined>(open ? initialReportId : undefined);
  const [prevOpen, setPrevOpen] = useState(open);
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), open ? 1000 : null);

  // Opening the dialog shows the requested report (or the list)
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDetailId(initialReportId);
  }

  const items = huntListItems(reports, hunts);
  const shown = items.filter((item) => matchesFilter(item, filter));
  const detail = detailId ? reports?.find((report) => report._id === detailId) : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-3 sm:max-w-4xl max-md:h-dvh max-md:max-h-dvh max-md:max-w-none max-md:rounded-none">
        <DialogHeader>
          <DialogTitle>Alle hunts</DialogTitle>
          <DialogDescription className="sr-only">Alle geregistreerde hunts en hunts van jotihunt.nl.</DialogDescription>
        </DialogHeader>

        {detail ? (
          <HuntDetail key={detail._id} report={detail} onBack={() => setDetailId(undefined)} />
        ) : (
          <>
            <Totals items={items} />
            <ToggleGroup type="single" variant="outline" size="sm" aria-label="Filter" className="max-md:w-full" value={filter} onValueChange={(next) => next && setFilter(next as Filter)}>
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
                <Table className="max-md:text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="max-md:hidden">Foto</TableHead>
                      <TableHead>
                        <span className="max-md:sr-only">Deelgebied</span>
                      </TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead className="max-md:hidden">Soort</TableHead>
                      <TableHead>Tijd</TableHead>
                      <TableHead className="max-md:hidden">Gemeld door</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Punten</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.map((item) => (
                      <HuntRow key={item.source === 'app' ? item.report._id : `site-${item.hunt._id}`} item={item} now={now} onSelect={setDetailId} />
                    ))}
                  </TableBody>
                </Table>
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
