import Settings from '@/components/Settings';
import { useStartTour } from '@/components/tour/useTour';
import CountdownPill from './CountdownPill';
import DemoBadge from './DemoBadge';

export default function SidebarHeader() {
  const startTour = useStartTour();
  const logoUrl: string = import.meta.env.LOGO_URL || '/pwa-512x512.png';
  const groupName: string = import.meta.env.GROUP_NAME;

  return (
    <div className="card flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-card-foreground">
      <img src={logoUrl} alt="" className="size-8 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold leading-tight">Jotihunt Tracker</p>
        {groupName && <p className="truncate text-xs text-muted-foreground">{groupName}</p>}
      </div>
      <DemoBadge />
      <CountdownPill />
      <Settings onReplayTour={() => startTour('replay')} />
    </div>
  );
}
