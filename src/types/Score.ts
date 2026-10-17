/** API contract of the jotihunt.nl score (spec 2026-10-17-points-card). */

/** The dashboard's split of the provisional score */
export interface ScoreParts {
  hunts: number;
  counterHunts: number;
  assignments: number;
  photoAssignments: number;
  /** null while the site shows "?" (not judged yet) */
  hints: number | null;
  /** As the site shows it: positive = points subtracted */
  penalty: number;
}

/** GET /score */
export interface ScoreStatus {
  /** A jotihunt.nl login is set in Beheer */
  configured: boolean;
  lastSuccessAt: string | null;
  /** Dutch, short; set while the last read failed */
  lastError: string | null;
  /** The site's total ("Voorlopig aantal punten"); null before the first read */
  total: number | null;
  parts: ScoreParts;
  /** The total before the last change */
  previousTotal: number | null;
  /** When the total last changed */
  changedAt: string | null;
}
