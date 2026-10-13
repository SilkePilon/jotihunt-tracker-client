import CookieBadge from '@/components/tracker/CookieBadge';
import { formatClock, formatCountdown } from '@/lib/format';
import { GROUP_LABEL, GROUP_TEXT_CLASS, type HqFox } from '@/lib/hq-director';
import { cn, getColorFromArea } from '@/lib/utils';

function FoxTile({ fox, focused }: { fox: HqFox; focused: boolean }) {
  const cooldown = fox.group === 'cooldown';
  return (
    <div
      className={cn(
        'card flex min-w-0 flex-col gap-0.5 rounded-2xl bg-card px-3 py-2.5 text-card-foreground outline-3 -outline-offset-1 outline-transparent transition-[outline-color,scale] duration-600 motion-reduce:transition-none',
        focused && 'scale-[1.03] outline-primary',
      )}
    >
      <div className="flex items-center gap-2 font-semibold">
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(fox.key) }} />
        <span className="truncate">{fox.name}</span>
        {fox.group === 'green' && <CookieBadge tone="ok" size={24} className="ml-auto size-[1.4rem]" />}
      </div>
      <div className={cn('text-[1.55rem] font-bold leading-tight tabular-nums', GROUP_TEXT_CLASS[fox.group])}>{cooldown ? formatCountdown(fox.cooldownMs) : GROUP_LABEL[fox.group]}</div>
      <div className="text-xs text-muted-foreground tabular-nums">
        {cooldown && 'cooldown · '}hunt {fox.lastHunt ? formatClock(fox.lastHunt) : '–'}
      </div>
    </div>
  );
}

/** All areas as tiles (3 per row); the one the camera looks at is outlined. */
export default function FoxBoard({ foxes, focusArea }: { foxes: HqFox[]; focusArea: string | null }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {foxes.map((fox) => (
        <FoxTile key={fox.key} fox={fox} focused={fox.key === focusArea} />
      ))}
    </div>
  );
}
