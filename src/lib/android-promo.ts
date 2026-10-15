// src/lib/android-promo.ts
/** One-time "there's an Android app" popup: who sees it and when (see the android-app-promo spec). */
export const PROMO_STORAGE_KEY = 'jh-android-promo';
export const LATER_MS = 3 * 24 * 60 * 60 * 1000;
/** The deep link opens the app within this time; still on the page after it = the app isn't installed. */
export const APP_OPEN_TIMEOUT_MS = 2500;

export type PromoState = { hiddenUntil?: number; never?: true };

export interface PromoInput {
  isMobile: boolean;
  isAndroid: boolean;
  hasRelease: boolean;
  paired: boolean;
  installed: boolean;
  state: PromoState;
  now: number;
}

export function isAndroidUserAgent(ua: string): boolean {
  return /Android/i.test(ua);
}

export function readPromoState(storage: Pick<Storage, 'getItem'>): PromoState {
  try {
    const value: unknown = JSON.parse(storage.getItem(PROMO_STORAGE_KEY) ?? '{}');
    if (!value || typeof value !== 'object') return {};
    const { hiddenUntil, never } = value as Record<string, unknown>;
    return { ...(typeof hiddenUntil === 'number' ? { hiddenUntil } : {}), ...(never === true ? { never: true as const } : {}) };
  } catch {
    return {};
  }
}

export function writePromoState(storage: Pick<Storage, 'setItem'>, state: PromoState): void {
  storage.setItem(PROMO_STORAGE_KEY, JSON.stringify(state));
}

export function laterState(now: number): PromoState {
  return { hiddenUntil: now + LATER_MS };
}

export function shouldShowAndroidPromo({ isMobile, isAndroid, hasRelease, paired, installed, state, now }: PromoInput): boolean {
  if (!isMobile || !isAndroid || !hasRelease || paired || installed || state.never) return false;
  return state.hiddenUntil === undefined || now >= state.hiddenUntil;
}

export function appDidNotOpen(startedAt: number, now: number, visible: boolean): boolean {
  return visible && now - startedAt >= APP_OPEN_TIMEOUT_MS;
}
