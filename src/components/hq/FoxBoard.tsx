import { AnimatePresence, motion } from 'motion/react';
import LoadError from '@/components/LoadError';
import CookieBadge from '@/components/tracker/CookieBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatClock, formatCountdown } from '@/lib/format';
import { GROUP_LABEL, GROUP_TEXT_CLASS, type HqFox } from '@/lib/hq-director';
import type { LoadState } from '@/lib/load-state';
import { SWAP } from '@/lib/motion';
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

/** The usual six areas while they load */
const SKELETON_TILES = 6;

/** All areas as tiles (3 per row); the one the camera looks at is outlined. Skeleton tiles, an error or "Nog geen vossen" until there are any. */
export default function FoxBoard({ foxes, focusArea, state, onRetry }: { foxes: HqFox[]; focusArea: string | null; state: LoadState; onRetry: () => Promise<unknown> | unknown }) {
  const view = state === 'ready' && foxes.length === 0 ? 'empty' : state;
  return (
    <AnimatePresence mode="wait" initial={false}>
      {view === 'loading' ? (
        <motion.div key="loading" {...SWAP} className="grid grid-cols-3 gap-2" role="status" aria-label="Vossen laden">
          {/* Same height as a fox tile: name, status and hunt line */}
          {Array.from({ length: SKELETON_TILES }, (_, index) => (
            <Skeleton key={index} className="h-[5.9rem] rounded-2xl" />
          ))}
        </motion.div>
      ) : view === 'error' ? (
        <motion.div key="error" {...SWAP} className="card rounded-2xl bg-card px-3.5 py-3 text-card-foreground">
          <LoadError message="Vossen konden niet worden geladen." onRetry={onRetry} scale className="text-base" />
        </motion.div>
      ) : view === 'empty' ? (
        <motion.p key="empty" {...SWAP} className="card rounded-2xl bg-card px-3.5 py-3 text-lg text-muted-foreground">
          Nog geen vossen.
        </motion.p>
      ) : (
        <motion.div key="board" {...SWAP} className="grid grid-cols-3 gap-2">
          {foxes.map((fox) => (
            <FoxTile key={fox.key} fox={fox} focused={fox.key === focusArea} />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
