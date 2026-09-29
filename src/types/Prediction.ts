export type Confidence = 'low' | 'medium' | 'high';

export interface PredictionCandidate {
  teamApiId: number;
  name: string;
  lng: number;
  lat: number;
  /** 0–1 */
  probability: number;
  /** ISO time */
  eta: string;
  walkMinutes: number;
}

export interface Prediction {
  area: string;
  status: string;
  paused: boolean;
  reason?: string;
  updatedAt: string;
  round: number;
  /** Walking times were straight-line estimates */
  estimate: boolean;
  /** The last AI run failed; this is an older prediction */
  stale: boolean;
  error?: string;
  lastObservation: { time: string; lng: number; lat: number; kind: 'hint' | 'hunt' | 'spot' } | null;
  /** AI best guess of the current fox position */
  pin: { lat: number; lng: number } | null;
  confidence: Confidence | null;
  candidates: PredictionCandidate[];
  visitedTeamApiIds: number[];
  /** One short Dutch sentence, shown behind ⓘ */
  why: string;
}

export type VisitState = 'visited' | 'not_visited';
export type VisitChoice = VisitState | 'auto';

export interface GroupVisit {
  area: string;
  teamApiId: number;
  round: number;
  state: VisitState;
  /** auto = decided by the AI */
  source: 'auto' | 'manual';
  visitedAt: string | null;
}
