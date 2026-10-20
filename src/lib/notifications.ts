export type NotificationType = 'fox-status' | 'hint' | 'article' | 'hunt-new' | 'hunt-approved' | 'hunt-rejected' | 'broadcast' | 'counter-hunt' | 'happy-hour' | 'hunt-cooldown';
/** Broadcasts from HQ can't be switched off */
export type OptionalNotificationType = Exclude<NotificationType, 'broadcast'>;
export type SoundKey = 'fox-green' | 'fox-status' | 'hint' | 'article' | 'hunt' | 'broadcast' | 'counter-hunt' | 'happy-hour';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  urgent: boolean;
  data: { area?: string; status?: string; previousStatus?: string; articleId?: number; huntId?: string; eventId?: string; points?: number; from?: string; direction?: number };
  createdAt: string;
}

export interface NotificationPrefs {
  disabledTypes: OptionalNotificationType[];
  promptedVersion: number;
}

/** Bump to show the "Meldingen" dialog again to everyone (e.g. after adding a type). */
export const NOTIFICATIONS_PROMPT_VERSION = 5;

/**
 * `short` is the one-liner on the tile; `description` stays as its tooltip and screen-reader text. `alsoTypes` are
 * switched together with `type` (one tile for approved + rejected).
 */
export const NOTIFICATION_OPTIONS: { type: OptionalNotificationType; alsoTypes?: OptionalNotificationType[]; label: string; short: string; description: string }[] = [
  { type: 'fox-status', label: 'Vossen status', short: 'Rood, oranje of groen', description: 'Als een deelgebied rood, oranje of groen wordt (groen = jagen mag).' },
  { type: 'hint', label: 'Nieuwe hint', short: 'Zodra hij er is', description: 'Zodra de organisatie een hint publiceert.' },
  { type: 'article', label: 'Opdrachten en nieuws', short: 'Nieuwe berichten', description: 'Nieuwe opdrachten en nieuwsberichten.' },
  { type: 'hunt-new', label: 'Nieuwe hunt', short: 'Binnen op jotihunt.nl', description: 'Als jotihunt.nl een nieuwe hunt van ons laat zien.' },
  { type: 'hunt-approved', alsoTypes: ['hunt-rejected'], label: 'Hunt beoordeeld', short: 'Goed- of afgekeurd', description: 'Als jotihunt.nl een hunt goedkeurt (met punten) of afkeurt.' },
  { type: 'counter-hunt', label: 'Tegenhunt', short: 'Met richting', description: 'Als de Jotihunt-bot een tegenhunt meldt, en uit welke richting.' },
  { type: 'happy-hour', label: 'Happy hour', short: 'Hunts tellen dubbel', description: 'Als er een happy hour begint: hunts tellen dan dubbel.' },
  { type: 'hunt-cooldown', label: 'Weer huntbaar', short: '1 uur na onze hunt', description: 'Als een vos die we gehunt hebben na het uur weer gehunt mag worden (en groen of oranje is).' },
];

/** A tile's type plus the types switched with it. */
function tileTypes(type: OptionalNotificationType): OptionalNotificationType[] {
  return [type, ...(NOTIFICATION_OPTIONS.find((option) => option.type === type)?.alsoTypes ?? [])];
}

/** The disabled list after switching one tile (its type and `alsoTypes`) on or off. */
export function toggleType(disabled: readonly OptionalNotificationType[], type: OptionalNotificationType, on: boolean): OptionalNotificationType[] {
  const types = tileTypes(type);
  const rest = disabled.filter((item) => !types.includes(item));
  return on ? rest : [...rest, ...types];
}

/** The disabled list for the "Alles" switch: nothing disabled, or every optional type. */
export function setAllTypes(on: boolean): OptionalNotificationType[] {
  return on ? [] : NOTIFICATION_OPTIONS.flatMap((option) => tileTypes(option.type));
}

export function shouldAlert(type: NotificationType, disabledTypes: readonly string[]): boolean {
  return type === 'broadcast' || !disabledTypes.includes(type);
}

export function soundKey(notification: Pick<AppNotification, 'type' | 'data'>): SoundKey {
  switch (notification.type) {
    case 'fox-status':
      return notification.data.status === 'green' ? 'fox-green' : 'fox-status';
    case 'hunt-new':
    case 'hunt-approved':
    case 'hunt-rejected':
      return 'hunt';
    case 'hunt-cooldown':
      return 'fox-status';
    default:
      return notification.type;
  }
}

export function toastKind(notification: Pick<AppNotification, 'type' | 'data'>): 'success' | 'warning' | 'info' {
  if ((notification.type === 'fox-status' && notification.data.status === 'green') || notification.type === 'hunt-approved') return 'success';
  if (notification.type === 'hunt-rejected' || notification.type === 'broadcast' || notification.type === 'counter-hunt' || notification.type === 'happy-hour') return 'warning';
  return 'info';
}

/** Highest first: what the one sound of a poll (and the HQ banner) goes by. */
const SOUND_PRIORITY: SoundKey[] = ['fox-green', 'counter-hunt', 'broadcast', 'happy-hour', 'hunt', 'fox-status', 'hint', 'article'];

/** The most important of these notifications, or null when empty. The earliest one wins a tie. */
export function pickPrimary<T extends Pick<AppNotification, 'type' | 'data'>>(notifications: readonly T[]): T | null {
  let best: T | null = null;
  for (const notification of notifications) {
    if (best === null || SOUND_PRIORITY.indexOf(soundKey(notification)) < SOUND_PRIORITY.indexOf(soundKey(best))) best = notification;
  }
  return best;
}

/** Quiet notifications: "Happy hour voorbij" (sent non-urgent) and "weer huntbaar". No sound for those. */
export function isSilent(notification: Pick<AppNotification, 'type'> & { urgent?: boolean }): boolean {
  return notification.type === 'hunt-cooldown' || (notification.type === 'happy-hour' && notification.urgent === false);
}

export function pickSound(notifications: readonly (Pick<AppNotification, 'type' | 'data'> & { urgent?: boolean })[]): SoundKey | null {
  const primary = pickPrimary(notifications.filter((notification) => !isSilent(notification)));
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
