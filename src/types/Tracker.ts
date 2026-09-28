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
      uniqueId: string;
      vehicle: Vehicle;
      connected: boolean;
      stats: TrackerStats;
    };
