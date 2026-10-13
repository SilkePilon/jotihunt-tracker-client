import HuntTimelineItem from '@/components/hunts/HuntTimelineItem';
import { useHuntReports } from '@/hooks/hunt-reports.hook';

const FEED_SIZE = 3;
const noop = () => {};

/** The newest hunts on the sidebar's timeline; a new one slides in at the top. */
export default function HqHunts({ now }: { now: number }) {
  const { reports } = useHuntReports();
  const latest = (reports ?? []).slice(0, FEED_SIZE);

  return (
    <section className="card flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-card px-3.5 pb-3 pt-2.5 text-card-foreground">
      <header className="mb-1 flex items-center justify-between">
        <span className="font-semibold">Hunts</span>
        <span className="text-sm text-muted-foreground">laatste {FEED_SIZE}</span>
      </header>
      {latest.map((report, i) => (
        <div key={report._id} className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-1000">
          <HuntTimelineItem report={report} now={now} last={i === latest.length - 1} onSelect={noop} />
        </div>
      ))}
      {reports?.length === 0 && <p className="text-muted-foreground">Nog geen hunts.</p>}
    </section>
  );
}
