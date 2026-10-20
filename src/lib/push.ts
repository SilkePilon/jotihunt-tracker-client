import type { AxiosResponse } from 'axios';
import { isArchiveError } from './editions';

export type Fetch = <T>(url: string, method?: 'GET' | 'POST' | 'DELETE' | 'PUT', body?: unknown) => Promise<AxiosResponse<T>>;
export type PushResult = 'subscribed' | 'denied' | 'unsupported' | 'unavailable' | 'error';

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function isIos(userAgent: string): boolean {
  return /iPad|iPhone|iPod/.test(userAgent);
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iOS only allows push for an app added to the home screen. */
export function needsIosInstall(userAgent: string, standalone: boolean): boolean {
  return isIos(userAgent) && !standalone;
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  return isPushSupported() ? Notification.permission : 'unsupported';
}

export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

/** Ask permission (must run from a click) and register this device for push. */
export async function subscribePush(fetch: Fetch): Promise<PushResult> {
  if (!isPushSupported()) return 'unsupported';
  let publicKey: string;
  try {
    publicKey = (await fetch<{ publicKey: string }>('/push/vapid-key')).data.publicKey;
  } catch {
    return 'unavailable';
  }
  try {
    if ((await Notification.requestPermission()) !== 'granted') return 'denied';
    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
    await fetch('/push/subscribe', 'POST', subscription.toJSON());
    return 'subscribed';
  } catch (error) {
    console.warn('[push] subscribe failed', error);
    return 'error';
  }
}

/** On load: send an existing subscription again, so it belongs to the logged-in user (and survives an edition switch).
 * Quiet while an archive edition is shown: the server refuses it with 423 then. */
export async function resyncPush(fetch: Fetch): Promise<void> {
  if (!isPushSupported() || Notification.permission !== 'granted') return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) await fetch('/push/subscribe', 'POST', subscription.toJSON());
  } catch (error) {
    if (!isArchiveError(error)) console.warn('[push] resync failed', error);
  }
}

/** Longest logout waits for the server to forget this device. */
const UNSUBSCRIBE_TIMEOUT_MS = 3000;

/** On logout: stop pushes for this device (server and browser), so the next user here doesn't get this user's alerts. */
export async function unsubscribePush(fetch: Fetch, timeoutMs = UNSUBSCRIBE_TIMEOUT_MS): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Bounded, so logout never hangs on a bad connection
      await Promise.race([
        fetch('/push/subscribe', 'DELETE', { endpoint: subscription.endpoint }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      // Always drop the browser subscription, even when the server couldn't be reached
      await subscription.unsubscribe();
    }
  } catch (error) {
    // A 423 (archive edition shown) is expected; the browser subscription is dropped anyway
    if (!isArchiveError(error)) console.warn('[push] unsubscribe failed', error);
  }
}
