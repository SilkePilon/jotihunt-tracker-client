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

/** Push on this device: 'on' (granted), 'off' (never asked: one tap turns it on), 'blocked' (denied in the browser),
 * 'install' (iPhone browser tab: only the home-screen app gets push) or 'unsupported'. */
export type DevicePush = 'on' | 'off' | 'blocked' | 'install' | 'unsupported';

export function devicePush(permission: NotificationPermission | 'unsupported', iosInstall: boolean): DevicePush {
  if (iosInstall) return 'install';
  if (permission === 'unsupported') return 'unsupported';
  return permission === 'granted' ? 'on' : permission === 'denied' ? 'blocked' : 'off';
}

/** This device's push state (see devicePush). */
export function currentDevicePush(): DevicePush {
  if (typeof window === 'undefined') return 'unsupported';
  return devicePush(pushPermission(), needsIosInstall(navigator.userAgent, isStandalone()));
}

export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

/** Longest Opslaan waits for the service worker; without one (dev, a failed install) `ready` never settles. */
const SW_READY_TIMEOUT_MS = 8000;

/** `promise`, or a rejection once `ms` has passed without it settling. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** Ask permission (must run from a click) and register this device for push. A service worker that never becomes ready
 * counts as 'error' after `readyTimeoutMs`, so the caller (Meldingen's Opslaan) doesn't hang. */
export async function subscribePush(fetch: Fetch, readyTimeoutMs = SW_READY_TIMEOUT_MS): Promise<PushResult> {
  if (!isPushSupported()) return 'unsupported';
  let publicKey: string;
  try {
    publicKey = (await fetch<{ publicKey: string }>('/push/vapid-key')).data.publicKey;
  } catch {
    return 'unavailable';
  }
  try {
    if ((await Notification.requestPermission()) !== 'granted') return 'denied';
    const registration = await withTimeout(navigator.serviceWorker.ready, readyTimeoutMs);
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
 * Permission granted but no subscription (dropped by a logout, the browser or a cleared site) subscribes again, so push
 * doesn't silently stay off on this device. Quiet while an archive edition is shown: the server refuses it with 423 then. */
export async function resyncPush(fetch: Fetch): Promise<void> {
  if (!isPushSupported() || Notification.permission !== 'granted') return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      // No permission prompt here: it's already granted, so subscribing needs no click
      const { publicKey } = (await fetch<{ publicKey: string }>('/push/vapid-key')).data;
      subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    }
    await fetch('/push/subscribe', 'POST', subscription.toJSON());
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
    try {
      // Bounded, so logout never hangs on a bad connection
      await withTimeout(fetch('/push/subscribe', 'DELETE', { endpoint: subscription.endpoint }), timeoutMs);
    } finally {
      // Always drop the browser subscription, even when the server couldn't be reached
      await subscription.unsubscribe();
    }
  } catch (error) {
    // A 423 (archive edition shown) is expected; the browser subscription is dropped anyway
    if (!isArchiveError(error)) console.warn('[push] unsubscribe failed', error);
  }
}
