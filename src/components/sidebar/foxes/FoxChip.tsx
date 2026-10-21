import { AnimatePresence, motion } from 'motion/react';
import { LockIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useNow } from '@/hooks/now.hook';
import { formatCountdown } from '@/lib/format';
import { chipSinceText } from '@/lib/fox-history';
import { FOX_STATUS_TEXT, type SidebarFox } from '@/lib/fox-status';
import { FORBIDDEN_AREA_NOTE } from '@/lib/huntable-areas';
import { LAYOUT_SPRING, POP, POP_SPRING } from '@/lib/motion';
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
  onOpen: () => void;
}

/** Pop in only after the old chip has popped out of its previous group. */
const POP_IN = { ...POP_SPRING, delay: 0.15 };

/**
 * Area dot (a lock when we may not hunt it) + name + time since its last status change (the countdown in cooldown); a
 * click opens/closes its history panel. On a status change it pops out of its old group and pops into the new one.
 */
export default function FoxChip({ fox, hidden, forbidden, popIn, open, onOpen }: FoxChipProps) {
  const { area, lastHunt, cooldownMs } = fox;
  const now = useNow(true, 60_000);
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
      onClick={onOpen}
      className={cn(
        'cursor-pointer rounded-full ring-current transition-shadow duration-200 focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none',
        open ? 'ring-[1.5px]' : 'ring-0',
      )}
    >
      {/* Hidden / forbidden dim this inner layer, so the pop's own opacity on the button stays independent; the stronger dim (hidden) wins */}
      <span
        className={cn(
          'inline-flex h-[26px] items-center gap-1.5 rounded-full bg-fox-chip px-2.5 text-xs font-semibold transition-opacity duration-200 hover:brightness-110 motion-reduce:transition-none',
          hidden ? 'opacity-40' : forbidden && 'opacity-45',
        )}
      >
        {/* Fixed box so the swap doesn't shift the name; dot and lock pop out/in in place */}
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
                style={{ backgroundColor: getColorFromArea(area.name) }}
                initial={POP.initial}
                animate={POP.animate}
                exit={POP.exit}
                transition={POP.transition}
              />
            )}
          </AnimatePresence>
        </span>
        {fox.name}
        <span className="tabular-nums opacity-80">{chipSinceText(fox, now)}</span>
      </span>
    </motion.button>
  );
}
