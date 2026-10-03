export type NotificationType = 'fox-status' | 'hint' | 'article' | 'hunt-deadline' | 'broadcast' | 'counter-hunt';
/** Broadcasts from HQ can't be switched off */
export type OptionalNotificationType = Exclude<NotificationType, 'broadcast'>;
export type SoundKey = 'fox-green' | 'fox-status' | 'hint' | 'article' | 'deadline' | 'broadcast' | 'counter-hunt';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  urgent: boolean;
  data: { area?: string; status?: string; previousStatus?: string; articleId?: number; huntReportId?: string; from?: string; direction?: number };
  createdAt: string;
}

export interface NotificationPrefs {
  disabledTypes: OptionalNotificationType[];
  promptedVersion: number;
}

/** Bump to show the "Meldingen" dialog again to everyone (e.g. after adding a type). */
export const NOTIFICATIONS_PROMPT_VERSION = 2;

export const NOTIFICATION_OPTIONS: { type: OptionalNotificationType; label: string; description: string }[] = [
  { type: 'fox-status', label: 'Vossen status', description: 'Als een deelgebied rood, oranje of groen wordt (groen = jagen mag).' },
  { type: 'hint', label: 'Nieuwe hint', description: 'Zodra de organisatie een hint publiceert.' },
  { type: 'article', label: 'Opdrachten en nieuws', description: 'Nieuwe opdrachten en nieuwsberichten.' },
  { type: 'hunt-deadline', label: 'Hunt deadline', description: '10 minuten voordat een hunt ingestuurd moet zijn.' },
  { type: 'counter-hunt', label: 'Tegenhunt', description: 'Als HQ meldt dat er een tegenhunt is, en in welke richting.' },
];

export function shouldAlert(type: NotificationType, disabledTypes: readonly string[]): boolean {
  return type === 'broadcast' || !disabledTypes.includes(type);
}

export function soundKey(notification: Pick<AppNotification, 'type' | 'data'>): SoundKey {
  switch (notification.type) {
    case 'fox-status':
      return notification.data.status === 'green' ? 'fox-green' : 'fox-status';
    case 'hunt-deadline':
      return 'deadline';
    default:
      return notification.type;
  }
}

export function toastKind(notification: Pick<AppNotification, 'type' | 'data'>): 'success' | 'warning' | 'info' {
  if (notification.type === 'fox-status' && notification.data.status === 'green') return 'success';
  if (notification.type === 'hunt-deadline' || notification.type === 'broadcast' || notification.type === 'counter-hunt') return 'warning';
  return 'info';
}

/** Highest first: what the one sound of a poll (and the HQ banner) goes by. */
const SOUND_PRIORITY: SoundKey[] = ['fox-green', 'counter-hunt', 'broadcast', 'deadline', 'fox-status', 'hint', 'article'];

/** The most important of these notifications, or null when empty. The earliest one wins a tie. */
export function pickPrimary<T extends Pick<AppNotification, 'type' | 'data'>>(notifications: readonly T[]): T | null {
  let best: T | null = null;
  for (const notification of notifications) {
    if (best === null || SOUND_PRIORITY.indexOf(soundKey(notification)) < SOUND_PRIORITY.indexOf(soundKey(best))) best = notification;
  }
  return best;
}

export function pickSound(notifications: readonly Pick<AppNotification, 'type' | 'data'>[]): SoundKey | null {
  const primary = pickPrimary(notifications);
  return primary ? soundKey(primary) : null;
}

/** Created at most `maxAgeMs` before the server's clock: older ones were already pushed, don't alert again after e.g. a backgrounded phone resumes. */
export function isRecent(notification: Pick<AppNotification, 'createdAt'>, serverTime: string, maxAgeMs: number): boolean {
  return new Date(serverTime).getTime() - new Date(notification.createdAt).getTime() <= maxAgeMs;
}

const SEEN_LIMIT = 200;

/** The notifications not handled yet; marks them as seen (the feed is polled with an overlapping window). */
export function mergeFeed(seen: Set<string>, incoming: AppNotification[]): AppNotification[] {
  const fresh = incoming.filter((notification) => !seen.has(notification.id));
  for (const notification of fresh) seen.add(notification.id);
  while (seen.size > SEEN_LIMIT) seen.delete(seen.values().next().value as string);
  return fresh;
}
