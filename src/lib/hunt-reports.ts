import { distance } from '@turf/turf';
import type { Hunt } from '@/types/Hunt';
import type { HuntListItem, HuntReport } from '@/types/HuntReport';
import type { Prediction } from '@/types/Prediction';

/** Same rule as the server: no whitespace, uppercase. */
export function normalizeHuntCode(code: string): string {
  return code.replace(/\s+/g, '').toUpperCase();
}

/** Extract hunt code from OCR text: labelled code if present, else longest token with letter+digit,
 * else longest non-stop-word token. Returns '' if none found. */
export function extractHuntCode(ocrText: string): string {
  const text = ocrText.toUpperCase();
  const stopWords = new Set(['JOTIHUNT', 'HUNTCODE', 'CODE', 'HUNT', 'TEGENHUNT', 'SCOUTING', 'ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL', 'OSCAR']);
  const isStopWord = (token: string): boolean => stopWords.has(token) || /^20\d\d$/.test(token);
  const tokens = text.match(/[A-Z0-9]{4,}/g) ?? [];

  // 1. Labelled code: "CODE" optionally followed by ":" or whitespace, then a token
  const labelledMatch = text.match(/CODE\s*:?\s*([A-Z0-9]{4,})/);
  if (labelledMatch && !isStopWord(labelledMatch[1])) {
    return labelledMatch[1];
  }

  // 2. Longest token with both letter and digit
  const withMixed = tokens.filter((token) => /[A-Z]/.test(token) && /[0-9]/.test(token));
  if (withMixed.length > 0) {
    return withMixed.reduce((longest, token) => (token.length > longest.length ? token : longest), '');
  }

  // 3. Longest token that is not a stop word
  const nonStopWords = tokens.filter((token) => !isStopWord(token));
  if (nonStopWords.length > 0) {
    return nonStopWords.reduce((longest, token) => (token.length > longest.length ? token : longest), '');
  }

  // 4. Otherwise empty string
  return '';
}

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * The most recent occurrence of HH:MM (local time). More than 5 minutes in the future means yesterday:
 * the hunt runs through the night, so 23:55 registered at 00:10 is last night.
 */
export function resolveHuntTime(hours: number, minutes: number, now: Date): Date {
  const time = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
  if (time.getTime() - now.getTime() > FUTURE_TOLERANCE_MS) time.setDate(time.getDate() - 1);
  return time;
}

/** Area whose last observation (hint/hunt/spot) is closest to the phone, or null. */
export function nearestArea(position: { lng: number; lat: number } | null, predictions: Prediction[] | undefined): string | null {
  if (!position || !predictions) return null;
  let best: { area: string; km: number } | null = null;
  for (const prediction of predictions) {
    const observation = prediction.lastObservation;
    if (!observation) continue;
    const km = distance([position.lng, position.lat], [observation.lng, observation.lat]);
    if (!best || km < best.km) best = { area: prediction.area, km };
  }
  return best?.area ?? null;
}

export function huntStatusLabel(report: HuntReport): string {
  switch (report.status) {
    case 'to_submit':
      return 'Te versturen';
    case 'overdue':
      return 'Te laat!';
    case 'submitted':
      return 'Ingestuurd';
    case 'judged':
      return report.site?.status || 'Beoordeeld';
  }
}

/** Reports HQ still has to submit on jotihunt.nl. */
export function pendingReports(reports: HuntReport[] | undefined): HuntReport[] {
  return (reports ?? []).filter((report) => report.status === 'to_submit' || report.status === 'overdue');
}

/** Collapsed sidebar summary: "2 te versturen", or "5 hunts · 42 pt". */
export function huntsSummary(reports: HuntReport[] | undefined): string | undefined {
  if (!reports) return undefined;
  const pending = pendingReports(reports).length;
  if (pending) return `${pending} te versturen`;
  const points = reports.reduce((sum, report) => sum + (report.site?.points ?? 0), 0);
  return `${reports.length} hunts · ${points} pt`;
}

/** Own reports plus scraped jotihunt.nl hunts that match no report (by normalised code).
 * Note: report.huntCode is already normalised by the server. */
export function huntListItems(reports: HuntReport[] | undefined, hunts: Hunt[] | undefined): HuntListItem[] {
  const codes = new Set((reports ?? []).map((report) => report.huntCode));
  const websiteOnly = (hunts ?? []).filter((hunt) => hunt.huntCode && !codes.has(normalizeHuntCode(hunt.huntCode)));
  return [...(reports ?? []).map((report) => ({ source: 'app' as const, report })), ...websiteOnly.map((hunt) => ({ source: 'website' as const, hunt }))];
}

/** "14:05" in Dutch 24 h time. */
export function formatHuntTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}
