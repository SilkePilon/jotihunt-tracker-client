import { useState } from 'react';
import { CameraIcon, ListIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { useIsMobile } from '@/hooks/media.hook';
import { useNow } from '@/hooks/now.hook';
import { huntsSummary, pendingReports } from '@/lib/hunt-reports';
import SidebarSection from '@/components/sidebar/SidebarSection';
import AllHuntsDialog from './AllHuntsDialog';
import HuntPhotoInput from './HuntPhotoInput';
import HuntTimelineItem from './HuntTimelineItem';

/** Sidebar section for registered hunts: quick capture, the last few reports, and a link to the full list. */
export default function HuntsSection() {
  const { reports } = useHuntReports();
  const isMobile = useIsMobile();
  const now = useNow(true);
  const [allOpen, setAllOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  function openAll(reportId?: string) {
    setSelectedId(reportId);
    setAllOpen(true);
  }

  const summaryText = huntsSummary(reports);
  const summary = pendingReports(reports).length > 0 ? <Badge variant="destructive">{summaryText}</Badge> : summaryText;

  return (
    <>
      <SidebarSection id="hunts" title="Hunts" summary={summary}>
        <div className="flex flex-col gap-2">
          {reports !== undefined && (
            reports.length ? (
              <div className="flex flex-col">
                {reports.slice(0, 3).map((report, index, shown) => (
                  <HuntTimelineItem key={report._id} report={report} now={now} last={index === shown.length - 1} onSelect={() => openAll(report._id)} />
                ))}
              </div>
            ) : (
              <Empty className="border-2 border-muted-foreground/40 p-4 md:p-6">
                <EmptyHeader>
                  <EmptyTitle className="text-sm">Nog geen hunts geregistreerd</EmptyTitle>
                  <EmptyDescription className="text-xs">Maak een foto van een hunt om hem te registreren.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )
          )}
          <div className="flex gap-2">
            <HuntPhotoInput capture={isMobile}>
              {(open) => (
                <Button size="sm" className="flex-1" onClick={open}>
                  <CameraIcon data-icon="inline-start" />
                  Hunt registreren
                </Button>
              )}
            </HuntPhotoInput>
            <Button variant="outline" size="sm" onClick={() => openAll()} aria-label="Alle hunts bekijken">
              <ListIcon data-icon="inline-start" />
              Alle
            </Button>
          </div>
        </div>
      </SidebarSection>
      <AllHuntsDialog open={allOpen} onOpenChange={setAllOpen} initialReportId={selectedId} />
    </>
  );
}
