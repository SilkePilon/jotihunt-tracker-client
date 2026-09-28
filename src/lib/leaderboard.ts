import type { Leaderboard, LeaderboardEntry } from '@/types/Leaderboard';

const POINTS_PER_HUNT = 2;
const POINTS_PER_HINT = 3;

/** Kilometres in Dutch notation, at most one decimal ("14,9"). */
export function formatKm(km: number): string {
  return km.toLocaleString('nl-NL', { maximumFractionDigits: 1 });
}

/** Avatar text: first letters of the first two words, else the first two letters ("Me"). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2);
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Podium order 2-1-3; missing places stay `undefined` so the columns keep their position. */
export function podiumOrder(entries: LeaderboardEntry[]): (LeaderboardEntry | undefined)[] {
  return [entries[1], entries[0], entries[2]];
}

/** How the score is made up, e.g. "Hunts 2 × 2 = 4 · jotihunt.nl 10 · Hints 1 × 3 = 3 · 14,9 km = 2". */
export function breakdownText(entry: LeaderboardEntry): string {
  const parts: string[] = [];
  if (entry.hunts > 0) parts.push(`Hunts ${entry.hunts} × ${POINTS_PER_HUNT} = ${entry.breakdown.hunts}`);
  if (entry.breakdown.huntPoints > 0) parts.push(`jotihunt.nl ${entry.breakdown.huntPoints}`);
  if (entry.hints > 0) parts.push(`Hints ${entry.hints} × ${POINTS_PER_HINT} = ${entry.breakdown.hints}`);
  if (entry.distanceKm > 0) parts.push(`${formatKm(entry.distanceKm)} km = ${entry.breakdown.distance}`);
  return parts.length ? parts.join(' · ') : 'Nog geen punten';
}

/** Team totals: "Samen: 19,9 km · 3 hunts · 3 hints · snelste: Mulan 92 km/u". */
export function teamStripText(board: Leaderboard): string {
  const { distanceKm, hunts, hints, fastest } = board.totals;
  const parts: string[] = [];
  if (distanceKm > 0) parts.push(`${formatKm(distanceKm)} km`);
  parts.push(`${hunts} ${hunts === 1 ? 'hunt' : 'hunts'}`);
  parts.push(`${hints} ${hints === 1 ? 'hint' : 'hints'}`);
  if (fastest) parts.push(`snelste: ${fastest.name} ${Math.round(fastest.speedKmh)} km/u`);
  return `Samen: ${parts.join(' · ')}`;
}

/** Footer note about the distance window. */
export function windowText(board: Leaderboard): string {
  if (!board.distanceAvailable) return 'Kilometers tijdelijk niet beschikbaar';
  if (board.distanceWindow === 'today') return 'Kilometers van vandaag (de hunt is nog niet begonnen)';
  const since = new Date(board.distanceSince).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `Kilometers sinds ${since}`;
}
