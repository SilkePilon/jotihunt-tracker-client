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

/** Whether two disabled lists switch off the same types (order and duplicates don't matter): the Meldingen dialog's "unsaved changes". */
export function sameTypes(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((type) => right.has(type));
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

/** Phones: how long an HQ broadcast or a tegenhunt toast stays (it would otherwise cover the map until closed) */
export const PHONE_STICKY_TOAST_MS = 120_000;

/**
 * How long the toast stays: an HQ broadcast or a tegenhunt until it is closed (its close button) on a laptop, since
 * missing one costs; on a phone two minutes (PHONE_STICKY_TOAST_MS), so it doesn't sit over the map for good (Meldingen
 * keeps it). Urgent ones 30 s, the rest 8 s.
 */
export function toastDuration(notification: Pick<AppNotification, 'type' | 'urgent'>, phone = false): number {
  if (notification.type === 'broadcast' || notification.type === 'counter-hunt') return phone ? PHONE_STICKY_TOAST_MS : Infinity;
  return notification.urgent ? 30_000 : 8000;
}

export interface ToastOpeners {
  /** Laptop: open the hint/news article in the Intel window */
  openArticle?: (articleId: number) => void;
  /** Phone: open the Hints page in the sheet */
  openHints?: () => void;
}

/** The toast's "Openen" button for this notification, or undefined when there is nothing to open. */
export function toastAction(notification: Pick<AppNotification, 'type' | 'data'>, { openArticle, openHints }: ToastOpeners): { label: string; onClick: () => void } | undefined {
  const articleId = notification.data.articleId;
  if (openArticle && articleId !== undefined && (notification.type === 'hint' || notification.type === 'article')) return { label: 'Openen', onClick: () => openArticle(articleId) };
  if (openHints && notification.type === 'hint') return { label: 'Openen', onClick: openHints };
  return undefined;
}

/** What the push service worker posts to an open window when its notification is tapped (public/push-sw.js). */
export const NOTIFICATION_CLICK_MESSAGE = 'notification-click';

export interface PushClickOpeners {
  /** Laptop: the Intel window, on the article when the push carried one */
  openIntel?: (articleId?: number) => void;
  /** Phone: the Hints page in the sheet */
  openHints?: () => void;
}

/**
 * A tapped push notification, posted by the service worker to the window it focuses: open what the toast's "Openen"
 * would (a hint on a phone: the Hints page; a hint or news item on a laptop: the Intel window). False when the message
 * is something else or there is nothing to open (the app just comes to the front).
 */
export function routePushClick(message: unknown, { openIntel, openHints }: PushClickOpeners): boolean {
  if (typeof message !== 'object' || message === null) return false;
  const { type, data } = message as { type?: unknown; data?: unknown };
  if (type !== NOTIFICATION_CLICK_MESSAGE || typeof data !== 'object' || data === null) return false;
  const { type: notificationType, articleId } = data as { type?: unknown; articleId?: unknown };
  const article = typeof articleId === 'number' && Number.isFinite(articleId) ? articleId : undefined;
  if (openIntel && (notificationType === 'hint' || notificationType === 'article')) {
    openIntel(article);
    return true;
  }
  if (openHints && notificationType === 'hint') {
    openHints();
    return true;
  }
  return false;
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

/**
 * Without push on this device, notifications too old to alert (a backgrounded tab or a locked phone resuming) would be
 * gone without a trace: one quiet summary toast instead, "N meldingen gemist · nieuwste: …", with the newest one's
 * Openen action. Null when there is nothing missed.
 */
export function missedSummary(missed: readonly AppNotification[], openers: ToastOpeners): { title: string; action?: { label: string; onClick: () => void } } | null {
  if (missed.length === 0) return null;
  const newest = missed.reduce((best, notification) => (new Date(notification.createdAt).getTime() > new Date(best.createdAt).getTime() ? notification : best));
  const count = missed.length === 1 ? '1 melding gemist' : `${missed.length} meldingen gemist`;
  return { title: `${count} · nieuwste: ${newest.title}`, action: toastAction(newest, openers) };
}
