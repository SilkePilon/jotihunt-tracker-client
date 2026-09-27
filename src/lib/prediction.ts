import { format } from 'date-fns';
import type { Feature, FeatureCollection, LineString, Polygon } from 'geojson';
import type { GeoPolygon, GroupVisit, Prediction, PredictionAccuracy, PredictionCandidate, VisitChoice } from '@/types/Prediction';

export interface ZoneProperties {
  area: string;
  color: string;
  kind: 'core' | 'outer' | 'island';
  estimate: boolean;
}

export interface LineProperties {
  area: string;
  color: string;
  probability: number;
}

export interface PredictionLabel {
  key: string;
  lng: number;
  lat: number;
  text: string;
  color: string;
  via: PredictionCandidate['via'];
  transitLabel?: string;
}

/** Candidates below this probability get a line on the map but no label pill (clutter). */
export const MIN_LABEL_PROBABILITY = 0.05;
/** A prediction not recomputed for this long is shown as "verouderd". */
export const STALE_AFTER_MS = 10 * 60 * 1000;
const NO_GROUPS_REASON = 'Geen groepen gekoppeld';

/** 24h local clock time, e.g. "14:20". */
export function formatClock(iso: string): string {
  return format(new Date(iso), 'HH:mm');
}

/** Rounded percentage that never claims certainty: ">99%" and "<1%" at the extremes. */
export function formatProbability(probability: number): string {
  if (probability >= 0.995) return '>99%';
  if (probability < 0.005) return '<1%';
  return `${Math.round(probability * 100)}%`;
}

/** "62% · ~14:20" or "62% · had er al kunnen zijn" (transit is shown with an icon next to it). */
export function candidateLabel(candidate: PredictionCandidate): string {
  const when = candidate.overdue ? 'had er al kunnen zijn' : `~${formatClock(candidate.eta)}`;
  return `${formatProbability(candidate.probability)} · ${when}`;
}

export function accuracyLabel(accuracy: PredictionAccuracy): string {
  return accuracy.evaluations === 0 ? 'top-3 –' : `top-3 ${accuracy.top3Hits}/${accuracy.evaluations}`;
}

/** Accuracy text for the sidebar row, or null for areas without groups (nothing to predict). */
export function predictionAccuracyText(prediction: Prediction): string | null {
  return prediction.reason === NO_GROUPS_REASON ? null : accuracyLabel(prediction.accuracy);
}

/** True when the prediction was last recomputed more than 10 minutes before `nowMs`. */
export function isPredictionStale(prediction: Prediction, nowMs: number): boolean {
  return nowMs - new Date(prediction.updatedAt).getTime() > STALE_AFTER_MS;
}

/** Status text to show instead of the top candidate, or null for an active prediction. */
export function predictionStatusText(prediction: Prediction): string | null {
  if (prediction.paused) return prediction.reason ?? 'Voorspelling gepauzeerd';
  if (prediction.reason) return prediction.reason;
  if (prediction.candidates.length === 0) return 'Geen kandidaten meer in deze ronde';
  return null;
}

/** Collapsed sidebar summary: number of active predictions. */
export function predictionSummary(predictions?: Prediction[]): string | undefined {
  if (!predictions) return undefined;
  const active = predictions.filter((prediction) => !prediction.paused && prediction.candidates.length > 0).length;
  return active === 0 ? 'Geen actieve' : `${active} actief`;
}

/** Which of the three visit buttons is active: a manual state, or automatic. */
export function visitSelection(visit?: GroupVisit): VisitChoice {
  return visit?.source === 'manual' ? visit.state : 'auto';
}

export function visitStatusText(visit?: GroupVisit): string {
  if (!visit) return 'Nog niet bezocht (automatisch)';
  const state = visit.state === 'visited' ? 'Bezocht' : 'Niet bezocht';
  const source = visit.source === 'manual' ? 'handmatig' : 'automatisch';
  const time = visit.state === 'visited' && visit.visitedAt ? `, ${formatClock(visit.visitedAt)}` : '';
  return `${state} (${source}${time}) · ronde ${visit.round}`;
}

/**
 * GeoJSON for the prediction map layer: zones (outer, core, islands), lines from the last
 * position to the candidates and label positions (line midpoints, only for candidates ≥ 5 %).
 * Paused predictions are skipped.
 */
export function buildPredictionGeoJson(
  predictions: Prediction[],
  colorFor: (area: string) => string,
): { zones: FeatureCollection<Polygon, ZoneProperties>; lines: FeatureCollection<LineString, LineProperties>; labels: PredictionLabel[] } {
  const zones: Feature<Polygon, ZoneProperties>[] = [];
  const lines: Feature<LineString, LineProperties>[] = [];
  const labels: PredictionLabel[] = [];

  for (const prediction of predictions) {
    if (prediction.paused) continue;
    const color = colorFor(prediction.area);
    const addZone = (geometry: GeoPolygon | null, kind: ZoneProperties['kind']) => {
      if (geometry) zones.push({ type: 'Feature', geometry, properties: { area: prediction.area, color, kind, estimate: prediction.estimate } });
    };
    addZone(prediction.zone.outer, 'outer');
    addZone(prediction.zone.core, 'core');
    prediction.zone.islands.forEach((island) => addZone(island, 'island'));

    const last = prediction.lastObservation;
    if (!last) continue;
    for (const candidate of prediction.candidates) {
      lines.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[last.lng, last.lat], [candidate.lng, candidate.lat]] },
        properties: { area: prediction.area, color, probability: candidate.probability },
      });
      if (candidate.probability < MIN_LABEL_PROBABILITY) continue;
      labels.push({
        key: `${prediction.area}-${candidate.teamApiId}`,
        lng: (last.lng + candidate.lng) / 2,
        lat: (last.lat + candidate.lat) / 2,
        text: candidateLabel(candidate),
        color,
        via: candidate.via,
        ...(candidate.transitLabel ? { transitLabel: candidate.transitLabel } : {}),
      });
    }
  }

  return { zones: { type: 'FeatureCollection', features: zones }, lines: { type: 'FeatureCollection', features: lines }, labels };
}
