import type { ComponentType } from 'react';
import { BadgeCheckIcon, FlagIcon, InboxIcon, LightbulbIcon, MegaphoneIcon, NewspaperIcon, SirenIcon, TimerIcon } from 'lucide-react';
import { CelebrationIcon } from '@/components/MaterialGlyph';
import type { NotificationType } from '@/lib/notifications';

export type NotificationIcon = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

/**
 * One icon per notification type, shared by the Meldingen tiles, the highlight toasts, the tour's sound list and the phone
 * menu: the fox-status flag and the hint lightbulb of the fox history and Intel, the siren of the tegenhunt toast and the
 * happy-hour celebration glyph of the pill.
 */
export const NOTIFICATION_ICON: Record<NotificationType, NotificationIcon> = {
  'fox-status': FlagIcon,
  hint: LightbulbIcon,
  article: NewspaperIcon,
  'hunt-new': InboxIcon,
  'hunt-approved': BadgeCheckIcon,
  'hunt-rejected': BadgeCheckIcon,
  broadcast: MegaphoneIcon,
  'counter-hunt': SirenIcon,
  'happy-hour': CelebrationIcon,
  'hunt-cooldown': TimerIcon,
};
