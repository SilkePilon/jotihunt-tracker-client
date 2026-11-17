import { memo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { EyeOffIcon, LockIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useEdition } from '@/hooks/edition.hook';
import { useNow } from '@/hooks/now.hook';
import { formatCountdown } from '@/lib/format';
import { chipSinceText } from '@/lib/fox-history';
import { FOX_STATUS_TEXT, sameSidebarFox, type SidebarFox } from '@/lib/fox-status';
import { FORBIDDEN_AREA_NOTE } from '@/lib/huntable-areas';
import { LAYOUT_SPRING, POP, POP_SPRING } from '@/lib/motion';
import { COARSE_HIT_AREA } from '@/lib/hit-area';
import { cn, getColorFromArea } from '@/lib/utils';

const ago = (time: Date | string) => formatDistanceToNow(new Date(time), { locale: nl, addSuffix: true });

interface FoxChipProps {
  fox: SidebarFox;
  hidden: boolean;
  /** We may not hunt this fox (rule 5.1): dimmed, a lock instead of the area dot */
  forbidden: boolean;
  /** Pop in on mount (a status change moved the fox here); false on the card's first render */
  popIn: boolean;
  /** Its history panel is open (or about to open): ring in the group's text colour */
  open: boolean;
  /** Called with the fox's key; keep it stable so unchanged chips skip re-rendering */
  onOpen: (key: string) => void;
}

/** Pop in only after the old chip has popped out of its previous group. */
const POP_IN = { ...POP_SPRING, delay: 0.15 };

/**
 * Area dot (a lock when we may not hunt it) + name + time since its last status change (the countdown in cooldown); a
 * click opens/closes its history panel. On a status change it pops out of its old group and pops into the new one.
 */
function FoxChip({ fox, hidden, forbidden, popIn, open, onOpen }: FoxChipProps) {
  const { area, lastHunt, cooldownMs } = fox;
  const now = useNow(true, 60_000);
  // Archive editions: the time since the last change is meaningless (EditionReloader reloads the page on a switch)
  const { readOnly } = useEdition();
  const since = chipSinceText(fox, now, readOnly);
  const title =
    `${fox.name}: ${FOX_STATUS_TEXT[area.status] ?? area.status} (bijgewerkt ${ago(area.updatedAt)})` +
    ` · laatste hunt: ${lastHunt ? ago(lastHunt) : 'nog geen'}` +
    (cooldownMs > 0 ? ` · weer te hunten over ${formatCountdown(cooldownMs)}` : '') +
    (forbidden ? ` · ${FORBIDDEN_AREA_NOTE}` : '') +
    (hidden ? ' · verborgen' : '');
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
      onClick={() => onOpen(fox.key)}
      // Focus outline in the group's on-colour (currentColor): the orange ring is under 3:1 on the ok/warn fills
      className={cn(
        'cursor-pointer rounded-full ring-current transition-shadow duration-200 focus-visible:outline-2 focus-visible:outline-current motion-reduce:transition-none',
        COARSE_HIT_AREA,
        open ? 'ring-[1.5px]' : 'ring-0',
      )}
    >
      {/* Hidden / forbidden dim this inner layer, so the pop's own opacity on the button stays independent; the stronger dim (hidden) wins */}
      <span
        className={cn(
          'inline-flex h-[26px] items-center gap-1.5 rounded-full bg-fox-chip px-2.5 text-xs font-semibold transition-opacity duration-200 hover:brightness-110 motion-reduce:transition-none pointer-coarse:h-8 pointer-coarse:text-[13.5px]',
          hidden ? 'opacity-70' : forbidden && 'opacity-75',
        )}
      >
        {/* Fixed box so the swap doesn't shift the name; dot, lock and eye (hidden on the map) pop out/in in place */}
        <span className="relative grid size-2.5 shrink-0 place-items-center">
          <AnimatePresence initial={false}>
            {hidden ? (
              <motion.span key="hidden" className="absolute inset-0 grid place-items-center" initial={POP.initial} animate={POP.animate} exit={POP.exit} transition={POP.transition}>
                <EyeOffIcon aria-hidden className="size-2.5" strokeWidth={2.75} />
              </motion.span>
            ) : forbidden ? (
              <motion.span key="lock" className="absolute inset-0 grid place-items-center" initial={POP.initial} animate={POP.animate} exit={POP.exit} transition={POP.transition}>
                <LockIcon aria-hidden className="size-2.5" strokeWidth={2.75} />
              </motion.span>
            ) : (
              <motion.span
                key="dot"
                className="size-[7px] rounded-full"
                style={{ backgroundColor: getColorFromArea(area.name) }}
                initial={POP.initial}
                animate={POP.animate}
                exit={POP.exit}
                transition={POP.transition}
              />
            )}
          </AnimatePresence>
        </span>
        {/* Hidden and forbidden: the eye takes the slot, the lock stays beside it as a small badge (both still true) */}
        <AnimatePresence initial={false}>
          {hidden && forbidden && (
            <motion.span key="lock-badge" aria-hidden className="-ml-0.5 grid size-2.5 shrink-0 place-items-center" initial={POP.initial} animate={POP.animate} exit={POP.exit} transition={POP.transition}>
              <LockIcon className="size-2.5" strokeWidth={2.75} />
            </motion.span>
          )}
        </AnimatePresence>
        {fox.name}
        {/* Dimmed chips (hidden / forbidden) are dim enough already: a second dim would drop the time under 4.5:1 */}
        {since !== null && <span className={cn('tabular-nums', !hidden && !forbidden && 'opacity-80')}>{since}</span>}
      </span>
    </motion.button>
  );
}

/** The fox list is rebuilt on every cooldown tick: only chips whose fox (or other props) changed re-render. */
export default memo(
  FoxChip,
  (prev, next) =>
    sameSidebarFox(prev.fox, next.fox) &&
    prev.hidden === next.hidden &&
    prev.forbidden === next.forbidden &&
    prev.popIn === next.popIn &&
    prev.open === next.open &&
    prev.onOpen === next.onOpen,
);
