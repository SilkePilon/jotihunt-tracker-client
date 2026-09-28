import type { Vehicle } from './Tracker';

export interface User {
  _id: string;
  email: string;
  name: string;
  admin: boolean;
  password: string;
  requiresPasswordChange: boolean;
  /** The user's own Traccar device ("Mijn tracker"); only in admin user lists */
  tracker?: { deviceId: number; uniqueId: string; vehicle: Vehicle };
}
