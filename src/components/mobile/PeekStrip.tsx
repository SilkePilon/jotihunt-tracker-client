import { useEffect, useState } from 'react';
import { useTrackerStatus } from '@/hooks/tracker.hook';
import { trackerPeekLine } from '@/lib/tracker';
import { cookiePath, BADGE_COOKIE_DEPTH } from '@/lib/cookie-shape';
import { useSidebarFoxes } from '@/components/sidebar/foxes/useSidebarFoxes';
import { useHuntableAreas } from '@/hooks/huntable-areas.hook';
import FoxStatusBar from '@/components/sidebar/foxes/FoxStatusBar';
import { FOX_GROUP_LABEL, groupCounts } from '@/lib/fox-status';
import useMobileNavStore from '@/stores/mobile-nav.store';
import { cn } from '@/lib/utils';

const COOKIE_16 = cookiePath(16, BADGE_COOKIE_DEPTH);
const TONE_FILL = { ok: '#22c55e', warn: '#f59e0b', muted: 'var(--muted-foreground)' } as const;
const GROUP_ORDER = ['green', 'orange', 'cooldown', 'red'] as const;

/** Own tracker line; ticks every second for the age, on its own so the fox bar does not re-render with it. */
function TrackerLine({ onOpen }: { onOpen: () => void }) {
  const { status } = useTrackerStatus();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const line = trackerPeekLine(status, now);
  return (
    <button type="button" onClick={onOpen} className="flex min-h-9 items-center gap-2 text-left text-[13.5px]">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0">
        <path d={COOKIE_16} fill={TONE_FILL[line.tone]} />
      </svg>
      <span className={cn('truncate font-semibold', line.tone === 'warn' && 'text-amber-700 dark:text-amber-300')}>{line.text}</span>
    </button>
  );
}

/** Always-visible top of the phone sheet: own tracker line + Vossen status bar with legend. */
export default function PeekStrip() {
  const foxes = useSidebarFoxes();
  const { isForbidden } = useHuntableAreas();
  const push = useMobileNavStore((s) => s.push);
  const counts = foxes ? groupCounts(foxes) : undefined;

  return (
    <div className="flex flex-col gap-2 px-4 pb-3">
      <TrackerLine onOpen={() => push({ id: 'tracking' })} />
      {foxes && foxes.length > 0 && counts && (
        <button type="button" onClick={() => push({ id: 'foxes' })} className="flex flex-col gap-1.5 text-left" aria-label="Vossen openen">
          <FoxStatusBar foxes={foxes} size="full" isForbidden={isForbidden} />
          <span className="flex justify-between text-[11px] text-muted-foreground">
            {GROUP_ORDER.map((group) => (
              <span key={group}>
                <b className="font-semibold text-foreground">{counts[group]}</b> {FOX_GROUP_LABEL[group].toLowerCase()}
              </span>
            ))}
          </span>
        </button>
      )}
    </div>
  );
}
