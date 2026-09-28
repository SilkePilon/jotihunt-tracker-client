import { useState } from 'react';
import { CameraIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { useIsMobile } from '@/hooks/media.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { huntsSummary, pendingReports } from '@/lib/hunt-reports';
import SidebarSection from '@/components/sidebar/SidebarSection';
import AllHuntsDialog from './AllHuntsDialog';
import HuntPhotoInput from './HuntPhotoInput';
import HuntReportRow from './HuntReportRow';

/** Sidebar section for registered hunts: quick capture, the last few reports, and a link to the full list. */
export default function HuntsSection() {
  const { reports } = useHuntReports();
  const isMobile = useIsMobile();
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), 1000);
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
          <HuntPhotoInput capture={isMobile}>
            {(open) => (
              <Button size="sm" className="w-full" onClick={open}>
                <CameraIcon data-icon="inline-start" />
                Hunt registreren
              </Button>
            )}
          </HuntPhotoInput>
          {reports !== undefined && (
            reports.length ? (
              <div className="flex flex-col gap-1">
                {reports.slice(0, 3).map((report) => (
                  <HuntReportRow key={report._id} report={report} now={now} onSelect={() => openAll(report._id)} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nog geen hunts geregistreerd.</p>
            )
          )}
          <Button variant="ghost" size="sm" className="w-full" onClick={() => openAll()}>
            Alle hunts bekijken
          </Button>
        </div>
      </SidebarSection>
      <AllHuntsDialog open={allOpen} onOpenChange={setAllOpen} initialReportId={selectedId} />
    </>
  );
}
