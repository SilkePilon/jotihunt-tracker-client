/**
 * When the iOS "Installeer als app" sheet (react-ios-pwa-prompt) is due. The library's own check runs on mount and
 * counts every mount as a visit; it only mounts on its turn in the prompt queue, so the check lives here and the
 * library just shows it (`isShown`).
 */

/** Shown on the first this-many turns (the library's promptOnVisit 1 + timesToShow 2) */
export const IOS_INSTALL_TIMES = 2;
/** The library's localStorage entry ({ visits }) */
export const IOS_INSTALL_STORAGE_KEY = 'iosPwaPrompt';

export interface IosInstallEnv {
  userAgent: string;
  maxTouchPoints: number;
  /** navigator.standalone: already opened from the home screen */
  standalone: boolean;
  /** How often it was shown before (the library's visit count) */
  visits: number;
}

/** An iPhone, iPod or iPad (iPadOS says "Macintosh" but has touch), as the library detects it. */
export function isIosBrowser(userAgent: string, maxTouchPoints: number): boolean {
  const device = /(iphone|ipad|ipod|macintosh)/.exec(userAgent.toLowerCase())?.[1];
  if (!device) return false;
  return device !== 'macintosh' || maxTouchPoints > 1;
}

export function iosInstallDue(env: IosInstallEnv): boolean {
  return isIosBrowser(env.userAgent, env.maxTouchPoints) && !env.standalone && env.visits < IOS_INSTALL_TIMES;
}

/** The library's visit count from its localStorage entry; 0 when missing or unreadable. */
export function parseIosInstallVisits(raw: string | null): number {
  if (!raw) return 0;
  try {
    const visits = (JSON.parse(raw) as { visits?: unknown } | null)?.visits;
    return typeof visits === 'number' && Number.isFinite(visits) ? visits : 0;
  } catch {
    return 0;
  }
}

/** The environment of this browser (never throws: private mode can refuse localStorage). */
export function readIosInstallEnv(): IosInstallEnv {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(IOS_INSTALL_STORAGE_KEY);
  } catch {
    // Treated as never shown
  }
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone: 'standalone' in navigator && !!(navigator as Navigator & { standalone?: boolean }).standalone,
    visits: parseIosInstallVisits(raw),
  };
}
