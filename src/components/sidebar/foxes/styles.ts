import type { FoxGroup } from '@/lib/fox-status';

/** Tailwind classes per fox group: status-bar segment, tonal group block, text on the block. */
export const GROUP_CLASS: Record<FoxGroup, { bar: string; block: string; on: string }> = {
  green: { bar: 'bg-fox-ok', block: 'bg-fox-ok-group', on: 'text-fox-on-ok' },
  orange: { bar: 'bg-fox-warn', block: 'bg-fox-warn-group', on: 'text-fox-on-warn' },
  cooldown: { bar: 'bg-fox-cooldown', block: 'bg-fox-cooldown-group', on: 'text-fox-on-cooldown' },
  red: { bar: 'bg-fox-error', block: 'bg-fox-error-group', on: 'text-fox-on-error' },
};
