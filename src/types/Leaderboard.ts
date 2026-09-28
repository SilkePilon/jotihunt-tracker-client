/** Mirror of the server `GET /leaderboard` response (dates as ISO strings). */
export interface LeaderboardEntry {
  userId: string;
  name: string;
  /** Equal scores share a place (1, 2, 2, 4) */
  rank: number;
  score: number;
  hunts: number;
  approvedHunts: number;
  huntPoints: number;
  hints: number;
  distanceKm: number;
  topSpeedKmh: number | null;
  /** Points per component */
  breakdown: { hunts: number; huntPoints: number; hints: number; distance: number };
}

export interface Leaderboard {
  entries: LeaderboardEntry[];
  totals: { distanceKm: number; hunts: number; hints: number; fastest: { name: string; speedKmh: number } | null };
  /** ISO: start of the distance window */
  distanceSince: string;
  distanceWindow: 'hunt' | 'today';
  /** False when Traccar is not configured or failed */
  distanceAvailable: boolean;
  /** ISO */
  updatedAt: string;
}
