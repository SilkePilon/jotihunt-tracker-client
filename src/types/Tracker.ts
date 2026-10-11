export type Vehicle = 'walking' | 'bike' | 'car' | 'motorcycle';

export type TrackerNotConfiguredReason = 'client_url_missing' | 'client_url_invalid' | 'api_missing' | 'unreachable' | 'group_invalid';

export interface TrackerStats {
  /** ISO time of the last data Traccar received */
  lastUpdate?: string;
  speedKmh?: number;
  /** Battery percentage (0-100) */
  battery?: number;
  accuracyM?: number;
  distanceTodayM?: number;
}

/** Response of GET /tracker/me and PUT /tracker/me/vehicle */
export type TrackerMe =
  | { configured: false; reason: TrackerNotConfiguredReason; connected: false }
  | {
      configured: true;
      qrUrl: string;
      deepLink: string;
      osmandUrl: string;
      uniqueId: string;
      vehicle: Vehicle;
      connected: boolean;
      stats: TrackerStats;
    };

/** POST /tracker/pair */
export interface PairingCode {
  code: string;
  /** ISO time */
  expiresAt: string;
}

/** GET /app/latest */
export interface AppRelease {
  versionCode: number;
  versionName: string;
  sha256: string;
  /** Path on the API server, e.g. /app/download/jotihunt-1.0.0.apk */
  url: string;
}
