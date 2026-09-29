import { format } from 'date-fns';
import type { Feature, FeatureCollection, LineString } from 'geojson';
import type { Confidence, GroupVisit, Prediction, VisitChoice } from '@/types/Prediction';

export interface MapPin {
  area: string;
  lng: number;
  lat: number;
  color: string;
  stale: boolean;
}

/** Number of filled bars in the confidence signal icon. */
export const CONFIDENCE_LEVEL: Record<Confidence, 1 | 2 | 3> = { low: 1, medium: 2, high: 3 };
export const CONFIDENCE_LABEL: Record<Confidence, string> = { high: 'Zekerheid hoog', medium: 'Zekerheid middel', low: 'Zekerheid laag' };

/** 24h local clock time, e.g. "14:20". */
export function formatClock(iso: string): string {
  return format(new Date(iso), 'HH:mm');
}

/** Compact age: "nu", "4m", "2u". */
export function ageLabel(updatedAt: string, nowMs: number): string {
  const minutes = Math.floor((nowMs - new Date(updatedAt).getTime()) / 60_000);
  if (minutes < 1) return 'nu';
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}u`;
}

/** Text to show under the card header, or null for an active prediction. */
export function predictionStatusText(prediction: Prediction): string | null {
  if (prediction.paused) return prediction.reason ?? 'Gepauzeerd';
  if (prediction.reason) return prediction.reason;
  if (prediction.stale && !prediction.pin) return prediction.error ?? 'AI-voorspelling mislukt';
  return null;
}

/** Collapsed sidebar summary: number of predictions with a pin. */
export function predictionSummary(predictions?: Prediction[]): string | undefined {
  if (!predictions) return undefined;
  const active = predictions.filter((prediction) => !prediction.paused && prediction.pin).length;
  return active === 0 ? 'Geen actieve' : `${active} actief`;
}

/** Which of the three visit buttons is active: a manual state, or AI. */
export function visitSelection(visit?: GroupVisit): VisitChoice {
  return visit?.source === 'manual' ? visit.state : 'auto';
}

export function visitStatusText(visit?: GroupVisit): string {
  if (!visit) return 'Nog niet bezocht (AI)';
  const state = visit.state === 'visited' ? 'Bezocht' : 'Niet bezocht';
  const source = visit.source === 'manual' ? 'handmatig' : 'AI';
  const time = visit.source === 'manual' && visit.state === 'visited' && visit.visitedAt ? `, ${formatClock(visit.visitedAt)}` : '';
  return `${state} (${source}${time}) · ronde ${visit.round}`;
}

/** Map data: a dashed line from the last observation to the pin and the pins. */
export function buildPredictionMap(
  predictions: Prediction[],
  colorFor: (area: string) => string,
): { lines: FeatureCollection<LineString, { area: string; color: string }>; pins: MapPin[] } {
  const lines: Feature<LineString, { area: string; color: string }>[] = [];
  const pins: MapPin[] = [];
  for (const prediction of predictions) {
    if (prediction.paused || !prediction.pin) continue;
    const color = colorFor(prediction.area);
    const { pin, lastObservation: last } = prediction;
    pins.push({ area: prediction.area, lng: pin.lng, lat: pin.lat, color, stale: prediction.stale });
    if (last) {
      lines.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[last.lng, last.lat], [pin.lng, pin.lat]] },
        properties: { area: prediction.area, color },
      });
    }
  }
  return { lines: { type: 'FeatureCollection', features: lines }, pins };
}
