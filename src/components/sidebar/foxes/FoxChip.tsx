import { motion } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { formatCountdown } from '@/lib/format';
import type { SidebarFox } from '@/lib/fox-status';
import { getColorFromArea } from '@/lib/utils';

const STATUS_LABEL: Record<string, string> = { green: 'groen', orange: 'oranje', red: 'rood' };
const ago = (time: Date | string) => formatDistanceToNow(new Date(time), { locale: nl, addSuffix: true });

interface FoxChipProps {
  fox: SidebarFox;
  hidden: boolean;
  onToggle: () => void;
}

/** Area dot + name (+ cooldown); a click hides/shows the area on the map. Shares a layoutId so it slides between groups. */
export default function FoxChip({ fox, hidden, onToggle }: FoxChipProps) {
  const { area, lastHunt, cooldownMs } = fox;
  const title =
    `${fox.name}: ${STATUS_LABEL[area.status] ?? area.status} (bijgewerkt ${ago(area.updatedAt)})` +
    ` · laatste hunt: ${lastHunt ? ago(lastHunt) : 'nog geen'}` +
    (cooldownMs > 0 ? ` · weer te hunten over ${formatCountdown(cooldownMs)}` : '') +
    (hidden ? ' · verborgen' : '');
  return (
    <motion.button
      layoutId={`fox-chip-${fox.key}`}
      layout="position"
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      initial={false}
      animate={{ opacity: hidden ? 0.4 : 1 }}
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={!hidden}
      onClick={onToggle}
      className="inline-flex h-[26px] cursor-pointer items-center gap-1.5 rounded-full bg-fox-chip px-2.5 text-xs font-semibold hover:brightness-110 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className="size-[7px] shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(area.name) }} />
      {fox.name}
      {cooldownMs > 0 && <span className="tabular-nums opacity-80">{formatCountdown(cooldownMs)}</span>}
    </motion.button>
  );
}
