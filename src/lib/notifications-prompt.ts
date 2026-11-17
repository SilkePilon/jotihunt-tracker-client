import { NOTIFICATIONS_PROMPT_VERSION } from './notifications';
import type { DevicePush } from './push';

/** The prompt version this device last saved the Meldingen dialog for (the server's version is per user, not per device). */
const DEVICE_KEY = 'notifications-prompted-version';
/** Set by "Later": the prompt waits for the next session (a new tab or app start) instead of being marked seen. */
const SNOOZE_KEY = 'notifications-prompt-snoozed';

export interface PromptDueInput {
  /** The user's promptedVersion from the server */
  serverVersion: number;
  /** The version this device saved the dialog for (0 when never) */
  deviceVersion: number;
  /** "Later" was tapped earlier in this session */
  snoozed: boolean;
  push: DevicePush;
}

/**
 * Whether the Meldingen dialog should open by itself: a new prompt version for the user, or this device never saved it
 * while push is still off here (one tap turns it on; a phone after a laptop would otherwise stay silent). Not again in a
 * session where "Later" was tapped.
 */
export function notificationsPromptDue({ serverVersion, deviceVersion, snoozed, push }: PromptDueInput): boolean {
  if (snoozed) return false;
  return serverVersion < NOTIFICATIONS_PROMPT_VERSION || (deviceVersion < NOTIFICATIONS_PROMPT_VERSION && push === 'off');
}

/** Storage that may be missing or throw (private mode, blocked site data). */
type MaybeStorage = Pick<Storage, 'getItem' | 'setItem'> | undefined;

function storage(kind: 'localStorage' | 'sessionStorage'): MaybeStorage {
  try {
    return typeof window === 'undefined' ? undefined : window[kind];
  } catch {
    return undefined;
  }
}

export function readDevicePromptedVersion(store: MaybeStorage = storage('localStorage')): number {
  try {
    const value = Number(store?.getItem(DEVICE_KEY));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function markDevicePrompted(store: MaybeStorage = storage('localStorage')): void {
  try {
    store?.setItem(DEVICE_KEY, String(NOTIFICATIONS_PROMPT_VERSION));
  } catch {
    // Private mode: the server's version still counts
  }
}

export function isPromptSnoozed(store: MaybeStorage = storage('sessionStorage')): boolean {
  try {
    return store?.getItem(SNOOZE_KEY) === '1';
  } catch {
    return false;
  }
}

export function snoozePrompt(store: MaybeStorage = storage('sessionStorage')): void {
  try {
    store?.setItem(SNOOZE_KEY, '1');
  } catch {
    // Without sessionStorage the prompt can come back on the next load
  }
}
