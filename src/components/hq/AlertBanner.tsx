import type { AppNotification } from '@/lib/notifications';
import { bannerClass } from '@/lib/hq';
import { cn } from '@/lib/utils';

/** Full-screen alert on the HQ screen; click to dismiss early. */
export default function AlertBanner({ notification, onDismiss }: { notification: AppNotification | null; onDismiss: () => void }) {
  if (!notification) return null;
  return (
    <button type="button" onClick={onDismiss} className={cn('fixed inset-0 z-50 flex animate-pulse flex-col items-center justify-center gap-4 p-8 text-center', bannerClass(notification))}>
      <div className="text-7xl font-black leading-tight">{notification.title}</div>
      {notification.body && <div className="text-3xl font-medium">{notification.body}</div>}
    </button>
  );
}
