import Settings from '@/components/Settings';
import { cn } from '@/lib/utils';
import { useAppConfig } from '@/hooks/app-config.hook';
import { apiAssetUrl } from '@/lib/app-config';
import { useStartTour } from '@/components/tour/useTour';
import EditionBadge from './EditionBadge';
import ThemeToggle from './ThemeToggle';
import { HEADER_BUTTON_START } from './header-button';

export default function SidebarHeader() {
  const startTour = useStartTour();
  const { logoUrl, groupName } = useAppConfig();
  const logo = apiAssetUrl(logoUrl);

  return (
    <div className="card flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-card-foreground">
      <img src={logo} alt="" className="size-8 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold leading-tight">Jotihunt Tracker</p>
        {groupName && <p className="truncate text-xs text-muted-foreground">{groupName}</p>}
      </div>
      <EditionBadge />
      {/* Joined tonal group: 2px seam, 12px outer and 6px inner corners */}
      <div className="flex shrink-0 gap-0.5">
        <ThemeToggle className={cn(HEADER_BUTTON_START, 'rounded-l-lg rounded-r-[6px]')} />
        <Settings onReplayTour={() => startTour('replay')} />
      </div>
    </div>
  );
}
