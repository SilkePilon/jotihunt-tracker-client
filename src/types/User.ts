import type { Vehicle } from './Tracker';

export interface User {
  _id: string;
  email: string;
  name: string;
  admin: boolean;
  password: string;
  requiresPasswordChange: boolean;
  /** Highest onboarding tour version seen; missing on sessions from before the tour existed (treat as 0) */
  tutorialVersion?: number;
  /** The user's own Traccar device ("Mijn tracker"); only in admin user lists */
  tracker?: { deviceId: number; uniqueId: string; vehicle: Vehicle };
}
