import { MegaphoneIcon, SirenIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import { toast } from 'sonner';
import type { AppNotification } from '@/lib/notifications';
import { CelebrationIcon } from '@/components/MaterialGlyph';

/** Notifications that get a regular toast with a coloured border and icon, so they stand out from the rest. */
const HIGHLIGHT: Partial<Record<AppNotification['type'], { icon: ComponentType<{ className?: string }>; iconClass: string; borderClass: string }>> = {
  broadcast: { icon: MegaphoneIcon, iconClass: 'text-indigo-500', borderClass: 'border-2! border-indigo-500!' },
  'counter-hunt': { icon: SirenIcon, iconClass: 'text-red-500', borderClass: 'border-2! border-red-500!' },
  'happy-hour': { icon: CelebrationIcon, iconClass: 'text-amber-500', borderClass: 'border-2! border-amber-500!' },
};

/** Show a highlighted toast for this notification; false when its type has no highlight (use a regular toast). */
export function showHighlightToast(notification: AppNotification, duration: number): boolean {
  const style = HIGHLIGHT[notification.type];
  if (!style) return false;
  const Icon = style.icon;
  const title = notification.type === 'broadcast' && notification.data.from ? `${notification.title} · ${notification.data.from}` : notification.title;
  toast(title, { description: notification.body || undefined, icon: <Icon className={`size-4 ${style.iconClass}`} />, className: style.borderClass, duration });
  return true;
}
