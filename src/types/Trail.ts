import type { FeatureCollection, LineString, Polygon } from 'geojson';

export type LegMode = 'walk' | 'car' | 'extra';
export type LegReason = 'manual' | 'status-red' | 'status-orange' | 'too-fast' | 'walk';

export interface TrailProperties {
  id: string;
  area: string;
  fromId: string;
  toId: string;
  mode: LegMode;
  reason: LegReason;
  manual: boolean;
  night: boolean;
  nightFallback: boolean;
  fallback: boolean;
  fromTime: string;
  toTime: string;
  distanceM: number | null;
  durationS: number | null;
  walkDurationS: number | null;
  redFrom?: string;
  redTo?: string;
}

export type TrailCollection = FeatureCollection<LineString, TrailProperties>;
export interface TrailsResponse {
  enabled: boolean;
  trails: TrailCollection;
}

export type NightAreaKind = 'closed' | 'open';
export interface NightArea {
  id: string;
  name: string;
  kind: NightAreaKind;
  polygon: Polygon;
}
export interface RoutesSetting {
  enabled: boolean;
  areas: NightArea[];
}
export interface RouterStatus {
  configured: boolean;
  online: boolean;
  building: boolean;
  builtAt: string | null;
  report: { nightTagged: number; fallbackTagged: number; reserves: number } | null;
  lastError: string | null;
}
