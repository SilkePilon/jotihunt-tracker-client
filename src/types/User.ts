import type { Vehicle } from './Tracker';

export interface User {
  _id: string;
  name: string;
  admin: boolean;
  /** Highest onboarding tour version seen; missing on sessions from before the tour existed (treat as 0) */
  tutorialVersion?: number;
  /** Number of passkeys on the account (0: logged in through a link only) */
  passkeyCount?: number;
  /** Only in admin user lists */
  lastActiveAt?: string | null;
  /** The user's own Traccar device ("Mijn tracker"); only in admin user lists */
  tracker?: { deviceId: number; uniqueId: string; vehicle: Vehicle };
}
