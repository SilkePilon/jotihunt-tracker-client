import type { Polygon } from 'geojson';

export type GeoPolygon = Polygon;

export interface PredictionCandidate {
  teamApiId: number;
  name: string;
  lng: number;
  lat: number;
  /** 0–1 */
  probability: number;
  travelMinutes: number;
  /** ISO time */
  eta: string;
  via: 'walk' | 'transit';
  transitLabel?: string;
  /** The ETA has passed: "had er al kunnen zijn" */
  overdue: boolean;
}

export interface PredictionAccuracy {
  top1Hits: number;
  top3Hits: number;
  evaluations: number;
}

export interface Prediction {
  area: string;
  status: string;
  mode: 'walking' | 'transit';
  /** Straight-line fallback was used (no ORS key or ORS error) */
  estimate: boolean;
  transitUnavailable: boolean;
  lastObservation: { time: string; lng: number; lat: number; kind: 'hint' | 'hunt' | 'spot' } | null;
  zone: { core: GeoPolygon | null; outer: GeoPolygon | null; islands: GeoPolygon[] };
  candidates: PredictionCandidate[];
  accuracy: PredictionAccuracy;
  updatedAt: string;
  paused: boolean;
  reason?: string;
  round: number;
}

export type VisitState = 'visited' | 'not_visited';
export type VisitChoice = VisitState | 'auto';

export interface GroupVisit {
  area: string;
  teamApiId: number;
  round: number;
  state: VisitState;
  source: 'auto' | 'manual';
  visitedAt: string | null;
}
