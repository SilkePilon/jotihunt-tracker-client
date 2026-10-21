import { AnimatePresence, motion } from 'motion/react';
import { LockIcon, TrainFrontIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useNow } from '@/hooks/now.hook';
import { formatOvDuration, type SidebarFox } from '@/lib/fox-status';
import { FORBIDDEN_AREA_NOTE } from '@/lib/huntable-areas';
import { LAYOUT_SPRING, POP, POP_SPRING } from '@/lib/motion';
import { cn, getColorFromArea } from '@/lib/utils';

/** Pop in only after the fox has popped out of its previous group (same as FoxChip). */
const POP_IN = { ...POP_SPRING, delay: 0.15 };

interface OvBlockProps {
  foxes: SidebarFox[];
  isHidden: (area: string) => boolean;
  isForbidden: (area: string) => boolean;
  /** Pop rows in on mount (a status change moved the fox here); false on the card's first render */
  popIn: boolean;
  /** Key of the fox whose history panel is open (ring on its row) */
  openKey: string | null;
  onOpen: (key: string) => void;
}

interface OvRowProps {
  fox: SidebarFox;
  hidden: boolean;
  forbidden: boolean;
  popIn: boolean;
  now: number;
  open: boolean;
  onOpen: () => void;
}

/** One OV fox: name + time on OV (click opens/closes its history), and a rail with a gliding train. */
function OvRow({ fox, hidden, forbidden, popIn, now, open, onOpen }: OvRowProps) {
  const since = new Date(fox.area.updatedAt);
  const duration = formatOvDuration(now - since.getTime());
  const title =
    `${fox.name}: met OV sinds ${formatDistanceToNow(since, { locale: nl, addSuffix: true })} · niet hunten` + (forbidden ? ` · ${FORBIDDEN_AREA_NOTE}` : '') + (hidden ? ' · verborgen' : '');
  return (
    <motion.button
      layout="position"
      initial={popIn ? POP.initial : false}
      animate={POP.animate}
      exit={POP.exit}
      transition={{ default: POP_IN, layout: LAYOUT_SPRING }}
      type="button"
      title={title}
      aria-label={title}
      aria-expanded={open}
      aria-controls={open ? `fox-history-${fox.key}` : undefined}
      onClick={onOpen}
      className={cn(
        'block w-full cursor-pointer rounded-xl text-left ring-current transition-shadow duration-200 focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none',
        open ? 'ring-[1.5px]' : 'ring-0',
      )}
    >
      <span className={cn('block px-0.5 transition-opacity duration-200 motion-reduce:transition-none', hidden ? 'opacity-40' : forbidden && 'opacity-45')}>
        <span className="flex items-center justify-between gap-2 text-xs font-bold">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span className="relative grid size-2.5 shrink-0 place-items-center">
              <AnimatePresence initial={false}>
                {forbidden ? (
                  <motion.span key="lock" className="absolute inset-0 grid place-items-center" initial={POP.initial} animate={POP.animate} exit={POP.exit} transition={POP.transition}>
                    <LockIcon aria-hidden className="size-2.5" strokeWidth={2.75} />
                  </motion.span>
                ) : (
                  <motion.span
                    key="dot"
                    className="size-[7px] rounded-full"
                    style={{ backgroundColor: getColorFromArea(fox.area.name) }}
                    initial={POP.initial}
                    animate={POP.animate}
                    exit={POP.exit}
                    transition={POP.transition}
                  />
                )}
              </AnimatePresence>
            </span>
            <span className="truncate">{fox.name} · in het OV</span>
          </span>
          <span className="shrink-0 font-semibold tabular-nums opacity-80">{duration}</span>
        </span>
        {/* Rail: dashed track between two stations, the train glides back and forth (still with reduced motion) */}
        <span aria-hidden className="relative mt-1.5 block h-[18px]">
          <span className="absolute inset-x-0 top-2 border-t-2 border-dashed border-fox-ov/55" />
          <span className="absolute top-1 left-0 size-2.5 rounded-full border-2 border-fox-ov bg-card" />
          <span className="absolute top-1 right-0 size-2.5 rounded-full border-2 border-fox-ov bg-card" />
          <span className="ov-train absolute top-0 grid h-[18px] w-[22px] place-items-center rounded-md bg-fox-ov text-fox-ov-group">
            <TrainFrontIcon className="size-3" strokeWidth={2.5} />
          </span>
        </span>
      </span>
    </motion.button>
  );
}

/** The Vossen card's OV group (mockup G): one row with a rail per fox travelling by OV (API status `blue`). */
export default function OvBlock({ foxes, isHidden, isForbidden, popIn, openKey, onOpen }: OvBlockProps) {
  const now = useNow(true);
  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence mode="popLayout" initial={false}>
        {foxes.map((fox) => (
          <OvRow key={fox.key} fox={fox} hidden={isHidden(fox.area.name)} forbidden={isForbidden(fox.area.name)} popIn={popIn} now={now} open={openKey === fox.key} onOpen={() => onOpen(fox.key)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
