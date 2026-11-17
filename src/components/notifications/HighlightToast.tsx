import { toast } from 'sonner';
import type { AppNotification } from '@/lib/notifications';
import { NOTIFICATION_ICON, type NotificationIcon } from './notification-icons';

/**
 * The 32px tonal tile that replaces sonner's 16px icon slot, holding an 18px icon. Same 12px corners as the sidebar buttons.
 */
const TILE = 'size-8! justify-center! rounded-xl! [&_svg]:m-0! [&_svg]:size-[18px]!';

/**
 * Notifications that get a regular toast with a tonal icon tile, so they stand out from the rest: a red tile for a counter
 * hunt, the happy-hour amber and the Intel nieuws purple for HQ broadcasts. Icon colours are >= 4.5:1 on their tile.
 */
const HIGHLIGHT: Partial<Record<AppNotification['type'], { icon: NotificationIcon; tileClass: string }>> = {
  broadcast: { icon: NOTIFICATION_ICON.broadcast, tileClass: 'bg-(--intel-news-container)! text-(--intel-news)!' },
  'counter-hunt': { icon: NOTIFICATION_ICON['counter-hunt'], tileClass: 'bg-fox-error-container! text-fox-on-error!' },
  'happy-hour': { icon: NOTIFICATION_ICON['happy-hour'], tileClass: 'bg-[color-mix(in_oklab,var(--happy-hour)_22%,var(--popover))]! text-status-warn-text!' },
};

/** Show a highlighted toast for this notification; false when its type has no highlight (use a regular toast). */
export function showHighlightToast(notification: AppNotification, duration: number): boolean {
  const style = HIGHLIGHT[notification.type];
  if (!style) return false;
  const Icon = style.icon;
  const title = notification.type === 'broadcast' && notification.data.from ? `${notification.title} · ${notification.data.from}` : notification.title;
  toast(title, { description: notification.body || undefined, icon: <Icon />, classNames: { icon: `${TILE} ${style.tileClass}` }, duration });
  return true;
}
