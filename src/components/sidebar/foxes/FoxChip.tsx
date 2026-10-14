import { motion } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { formatCountdown } from '@/lib/format';
import type { SidebarFox } from '@/lib/fox-status';
import { POP, POP_SPRING } from '@/lib/motion';
import { cn, getColorFromArea } from '@/lib/utils';

const STATUS_LABEL: Record<string, string> = { green: 'groen', orange: 'oranje', red: 'rood' };
const ago = (time: Date | string) => formatDistanceToNow(new Date(time), { locale: nl, addSuffix: true });

interface FoxChipProps {
  fox: SidebarFox;
  hidden: boolean;
  /** Pop in on mount (a status change moved the fox here); false on the card's first render */
  popIn: boolean;
  onToggle: () => void;
}

/** Pop in only after the old chip has popped out of its previous group. */
const POP_IN = { ...POP_SPRING, delay: 0.15 };

/** Area dot + name (+ cooldown); a click hides/shows the area on the map. On a status change it pops out of its old group and pops into the new one. */
export default function FoxChip({ fox, hidden, popIn, onToggle }: FoxChipProps) {
  const { area, lastHunt, cooldownMs } = fox;
  const title =
    `${fox.name}: ${STATUS_LABEL[area.status] ?? area.status} (bijgewerkt ${ago(area.updatedAt)})` +
    ` · laatste hunt: ${lastHunt ? ago(lastHunt) : 'nog geen'}` +
    (cooldownMs > 0 ? ` · weer te hunten over ${formatCountdown(cooldownMs)}` : '') +
    (hidden ? ' · verborgen' : '');
  return (
    <motion.button
      layout="position"
      initial={popIn ? POP.initial : false}
      animate={POP.animate}
      exit={POP.exit}
      transition={{ default: POP_IN, layout: { type: 'spring', stiffness: 380, damping: 34 } }}
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={!hidden}
      onClick={onToggle}
      className="cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-ring"
    >
      {/* Hidden dims this inner layer, so the pop's own opacity on the button stays independent */}
      <span
        className={cn(
          'inline-flex h-[26px] items-center gap-1.5 rounded-full bg-fox-chip px-2.5 text-xs font-semibold transition-opacity duration-200 hover:brightness-110 motion-reduce:transition-none',
          hidden && 'opacity-40',
        )}
      >
        <span className="size-[7px] shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(area.name) }} />
        {fox.name}
        {cooldownMs > 0 && <span className="tabular-nums opacity-80">{formatCountdown(cooldownMs)}</span>}
      </span>
    </motion.button>
  );
}
