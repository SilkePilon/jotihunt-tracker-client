import { isAxiosError } from 'axios';
import type { FeatureCollection, LineString } from 'geojson';
import type { LegMode, TrailCollection, TrailProperties } from '@/types/Trail';

const CLOCK = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const clock = (iso: string) => CLOCK.format(new Date(iso));

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}u ${m}m` : `${h}u`;
}

export function formatKm(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

const BADGE_PREFIX = 'trail-badge:';
export function badgeImageId(mode: LegMode, color: string): string | null {
  return mode === 'walk' ? null : `${BADGE_PREFIX}${mode}:${color}`;
}
export function parseBadgeImageId(id: string): { mode: 'car' | 'extra'; color: string } | null {
  if (!id.startsWith(BADGE_PREFIX)) return null;
  const [mode, color] = id.slice(BADGE_PREFIX.length).split(':');
  return (mode === 'car' || mode === 'extra') && color ? { mode, color } : null;
}

export function visibleTrails(trails: TrailCollection, visibleIds: Set<string>, colorFor: (area: string) => string): FeatureCollection<LineString, TrailProperties & { color: string; badge: string | null }> {
  return {
    type: 'FeatureCollection',
    features: trails.features
      .filter((f) => visibleIds.has(f.properties.fromId) && visibleIds.has(f.properties.toId))
      .map((f) => {
        const color = colorFor(f.properties.area);
        return { ...f, properties: { ...f.properties, color, badge: f.properties.fallback ? null : badgeImageId(f.properties.mode, color) } };
      }),
  };
}

const isCar = (p: TrailProperties) => p.mode !== 'walk';

export function legTitle(p: TrailProperties, areaTitle: string): string {
  return `${areaTitle} · ${isCar(p) ? 'Auto' : 'Lopen'}`;
}

export function legSubtitle(p: TrailProperties): string {
  let text: string;
  if (p.manual) text = 'Handmatig';
  else if (p.reason === 'status-red' && p.redFrom && p.redTo) text = `Automatisch · status rood ${clock(p.redFrom)}–${clock(p.redTo)}`;
  else if (p.reason === 'status-orange') text = 'Extra verplaatsing';
  else if (p.reason === 'too-fast') text = 'Automatisch · te snel om te lopen';
  else if (p.night) text = p.nightFallback ? "'s Nachts · geen route buiten de bossen" : "'s Nachts · bossen dicht";
  else text = 'Lopend';
  return p.fallback ? `${text} · rechte lijn` : text;
}

export function legRows(p: TrailProperties) {
  const elapsed = (new Date(p.toTime).getTime() - new Date(p.fromTime).getTime()) / 1000;
  const time = { title: formatDuration(elapsed), meta: `${clock(p.fromTime)} → ${clock(p.toTime)}` };
  if (p.fallback || p.distanceM === null) return { time, route: { title: 'Rechte lijn', meta: 'Router niet bereikbaar' } };
  if (isCar(p)) {
    return { time, route: { title: `${formatKm(p.distanceM)} over de weg`, meta: p.walkDurationS === null ? 'Lopen: onbekend' : `Lopen zou ${formatDuration(p.walkDurationS)} kosten` } };
  }
  return { time, route: { title: `${formatKm(p.distanceM)}${p.night ? ' · nachtroute' : ''}`, meta: `± ${formatDuration(p.durationS ?? 0)} lopen` } };
}

export const flipTarget = (p: TrailProperties): 'walk' | 'car' => (isCar(p) ? 'walk' : 'car');
export const flipLabel = (p: TrailProperties): string => (isCar(p) ? 'Toch gelopen' : 'Toch met auto');

/** Every leg is a straight fallback: the router is not ready or down, so the old coloured trails are clearer. */
export function allFallback(trails: TrailCollection): boolean {
  return trails.features.length > 0 && trails.features.every((f) => f.properties.fallback);
}

/** What a leg looks like on the map: a change means it should fade in again. */
export type LegLooks = Map<string, string>;
export function legLooks(features: { properties: Pick<TrailProperties, 'id' | 'mode' | 'fallback'> }[]): LegLooks {
  return new Map(features.map((f) => [f.properties.id, `${f.properties.mode}:${f.properties.fallback ? 1 : 0}`]));
}

/** Ids of legs that are new in `next` or changed mode/fallback since `previous`. */
export function changedLegIds(previous: LegLooks, next: LegLooks): string[] {
  return [...next].filter(([id, look]) => previous.get(id) !== look).map(([id]) => id);
}

export type RebuildResult = 'started' | 'busy' | 'failed';
/** A failed rebuild request: 409 means a rebuild is already running. */
export function rebuildFailure(error: unknown): Exclude<RebuildResult, 'started'> {
  return isAxiosError(error) && error.response?.status === 409 ? 'busy' : 'failed';
}
