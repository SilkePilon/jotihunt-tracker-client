import type { ScoreParts, ScoreStatus } from '@/types/Score';
import { formatAgo } from './life360';

/** How long the green "+10" stays next to the total after it changed */
export const SCORE_DELTA_MS = 10 * 60_000;

/** What an old server (404) or no answer at all means */
export const SCORE_NOT_CONFIGURED: ScoreStatus = {
  configured: false,
  lastSuccessAt: null,
  lastError: null,
  total: null,
  parts: { hunts: 0, counterHunts: 0, assignments: 0, photoAssignments: 0, hints: null, penalty: 0 },
  previousTotal: null,
  changedAt: null,
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/** GET /score with every missing or malformed field filled in (an older or half-built server); anything else = not configured. */
export function normalizeScore(data: unknown): ScoreStatus {
  if (!isRecord(data)) return SCORE_NOT_CONFIGURED;
  const parts = isRecord(data.parts) ? data.parts : {};
  return {
    configured: data.configured === true,
    lastSuccessAt: str(data.lastSuccessAt),
    lastError: str(data.lastError),
    total: num(data.total),
    parts: {
      hunts: num(parts.hunts) ?? 0,
      counterHunts: num(parts.counterHunts) ?? 0,
      assignments: num(parts.assignments) ?? 0,
      photoAssignments: num(parts.photoAssignments) ?? 0,
      hints: num(parts.hints),
      penalty: num(parts.penalty) ?? 0,
    },
    previousTotal: num(data.previousTotal),
    changedAt: str(data.changedAt),
  };
}

/** The green "+10" / "−5": for SCORE_DELTA_MS after the total changed, when there was a previous total and it differs; else null. */
export function scoreDelta(score: ScoreStatus, now: number): number | null {
  if (score.total === null || score.previousTotal === null || !score.changedAt) return null;
  const changed = Date.parse(score.changedAt);
  if (Number.isNaN(changed) || now - changed > SCORE_DELTA_MS) return null;
  const delta = score.total - score.previousTotal;
  return delta === 0 ? null : delta;
}

/** "+10", "−5" (a real minus sign) */
export function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}

export type ScorePartKey = keyof ScoreParts;

/** Per category: label and the Tailwind fill of its bar segment and legend square (mockup B colours) */
export const SCORE_CATEGORIES: Record<ScorePartKey, { label: string; fill: string }> = {
  hunts: { label: 'Hunts', fill: 'bg-orange-500' },
  counterHunts: { label: 'Tegenhunts', fill: 'bg-purple-500' },
  assignments: { label: 'Opdrachten', fill: 'bg-blue-500' },
  photoAssignments: { label: 'Foto', fill: 'bg-teal-500' },
  hints: { label: 'Hints', fill: 'bg-yellow-500' },
  penalty: { label: 'Straf', fill: 'bg-red-500' },
};

/** Bar order: hunts, tegenhunts, opdrachten, foto, hints */
const BAR_ORDER = ['hunts', 'counterHunts', 'assignments', 'photoAssignments', 'hints'] as const;

export interface ScoreSegment {
  key: (typeof BAR_ORDER)[number];
  value: number;
  /** 0–1 of the positive points */
  share: number;
}

/** Every bar category with its value and share; zero or unknown (hints "?") parts get share 0 so they shrink away. */
export function scoreBarSegments(parts: ScoreParts): ScoreSegment[] {
  const values = BAR_ORDER.map((key) => ({ key, value: Math.max(0, parts[key] ?? 0) }));
  const sum = values.reduce((total, { value }) => total + value, 0);
  return values.map(({ key, value }) => ({ key, value, share: sum === 0 ? 0 : value / sum }));
}

/** Legend order (two columns, row by row): Hunts | Opdrachten, Tegenhunts | Foto, Hints | Straf */
export const LEGEND_ORDER: readonly ScorePartKey[] = ['hunts', 'assignments', 'counterHunts', 'photoAssignments', 'hints', 'penalty'];

export interface LegendEntry {
  key: ScorePartKey;
  label: string;
  fill: string;
  /** null: unknown ("?") */
  value: number | null;
  tone: 'default' | 'muted' | 'penalty';
}

export function scoreLegend(parts: ScoreParts): LegendEntry[] {
  return LEGEND_ORDER.map((key) => {
    const value = parts[key];
    const tone = value === null ? 'muted' : key === 'penalty' && value !== 0 ? 'penalty' : 'default';
    return { key, ...SCORE_CATEGORIES[key], value, tone };
  });
}

/** Strafpunten as shown: "−10" (the site's positive number subtracted), "0" */
export function formatPenalty(penalty: number): string {
  return penalty === 0 ? '0' : `−${Math.abs(penalty)}`;
}

/** The last read failed (the server clears lastError on success) */
export function scoreFailing(score: ScoreStatus): boolean {
  return score.lastError !== null;
}

/** "voorlopig · 1 min geleden" */
export function scoreLine(score: ScoreStatus, now: number): string {
  return ['voorlopig', formatAgo(score.lastSuccessAt, now)].filter(Boolean).join(' · ');
}

/** Amber line while failing: "laatst gelukt 6 min geleden" / "nog niet gelukt" */
export function scoreFailingLine(score: ScoreStatus, now: number): string {
  const ago = formatAgo(score.lastSuccessAt, now);
  return ago ? `laatst gelukt ${ago}` : 'nog niet gelukt';
}

/** Collapsed header: "145 pnt"; undefined before the first read */
export function scoreSummary(score: ScoreStatus | undefined): string | undefined {
  return score?.total == null ? undefined : `${score.total} pnt`;
}
