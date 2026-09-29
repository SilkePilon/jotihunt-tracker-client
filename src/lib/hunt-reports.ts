import { distance } from '@turf/turf';
import type { Hunt } from '@/types/Hunt';
import type { HuntListItem, HuntReport } from '@/types/HuntReport';
import type { Prediction } from '@/types/Prediction';

/** Same rule as the server: hunt codes are case-sensitive ("GNcrZRZ"), only whitespace is removed. */
export function normalizeHuntCode(code: string): string {
  return code.replace(/\s+/g, '');
}

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const PAST_TOLERANCE_MS = DAY_MS - FUTURE_TOLERANCE_MS;

/**
 * The most recent occurrence of HH:MM (local time). More than 5 minutes in the future means yesterday:
 * the hunt runs through the night, so 23:55 registered at 00:10 is last night. Symmetrically, when the
 * naive same-day time lands more than 24 h − 5 min in the past, the written time is a few minutes ahead
 * of the phone clock just before midnight (e.g. 00:02 written at 23:59), so it means tomorrow.
 */
export function resolveHuntTime(hours: number, minutes: number, now: Date): Date {
  const time = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
  const diff = time.getTime() - now.getTime();
  if (diff > FUTURE_TOLERANCE_MS) time.setDate(time.getDate() - 1);
  else if (-diff > PAST_TOLERANCE_MS) time.setDate(time.getDate() + 1);
  return time;
}

/** Area whose best guess (pin) or last observation is closest to the phone, or null. */
export function nearestArea(position: { lng: number; lat: number } | null, predictions: Prediction[] | undefined): string | null {
  if (!position || !predictions) return null;
  let best: { area: string; km: number } | null = null;
  for (const prediction of predictions) {
    const point = prediction.pin ?? prediction.lastObservation;
    if (!point) continue;
    const km = distance([position.lng, position.lat], [point.lng, point.lat]);
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
  const codes = new Set((reports ?? []).flatMap((report) => (report.huntCode ? [report.huntCode] : [])));
  const websiteOnly = (hunts ?? []).filter((hunt) => hunt.huntCode && !codes.has(normalizeHuntCode(hunt.huntCode)));
  return [...(reports ?? []).map((report) => ({ source: 'app' as const, report })), ...websiteOnly.map((hunt) => ({ source: 'website' as const, hunt }))];
}

/** "14:05" in Dutch 24 h time. */
export function formatHuntTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

/** Same as {@link formatHuntTime}, but "–" for a missing or invalid time (scraped jotihunt.nl hunts can lack one). */
export function formatHuntTimeSafe(time: Date | string | null | undefined): string {
  if (!time) return '–';
  const date = new Date(time);
  return Number.isNaN(date.getTime()) ? '–' : formatHuntTime(date.toISOString());
}

/**
 * Code and photo stay blurred while the hunt still has to be submitted (not once submitted, overdue or judged).
 * Nothing is blurred while the code is unknown: HQ needs the photo to read it.
 */
export function isConcealed(report: HuntReport, now: number): boolean {
  return !!report.huntCode && report.status === 'to_submit' && new Date(report.deadline).getTime() >= now;
}

/** The server is still reading the code and time from the photo. */
export function isReading(report: HuntReport): boolean {
  return report.ocrStatus === 'pending' || report.ocrStatus === 'reading';
}

/** "14:05", or "±14:05" (the upload time) while the time on the photo is not known yet. */
export function huntTimeLabel(report: HuntReport): string {
  return `${report.huntTimeKnown ? '' : '±'}${formatHuntTime(report.huntTime)}`;
}

/** Lowest confidence (0..1) of the fields that were read from the photo, or null when no field comes from the photo. */
export function ocrConfidence(report: HuntReport): number | null {
  const confidences = [
    ...(report.huntCodeSource === 'ocr' ? [report.codeConfidence ?? 0] : []),
    ...(report.huntTimeSource === 'ocr' ? [report.timeConfidence ?? 0] : []),
  ];
  return confidences.length ? Math.min(...confidences) : null;
}

/** Reading the photo failed and HQ has not entered both fields by hand yet. */
export function readFailed(report: HuntReport): boolean {
  return report.ocrStatus === 'failed' && !(report.huntCodeSource === 'manual' && report.huntTimeSource === 'manual');
}

/** Where the code and time come from: "Gelezen door Gemini (zekerheid 92%)", "Handmatig ingevuld", "Wordt gelezen…", … */
/** Where the code/time came from; the technical failure reason only for admins (`withError`). */
export function huntSourceLabel(report: HuntReport, withError = false): string {
  if (isReading(report)) return 'Wordt gelezen…';
  const codeManual = report.huntCodeSource === 'manual';
  const timeManual = report.huntTimeSource === 'manual';
  if (codeManual && timeManual) return 'Handmatig ingevuld';
  if (readFailed(report)) return withError && report.ocrError ? `Lezen mislukt: ${report.ocrError}` : 'Lezen mislukt';
  const confidence = ocrConfidence(report);
  if (confidence === null) return codeManual || timeManual ? 'Handmatig ingevuld' : 'Niets gelezen van de foto';
  const read = `Gelezen door Gemini (zekerheid ${Math.round(confidence * 100)}%)`;
  if (codeManual) return `${read} · code handmatig`;
  if (timeManual) return `${read} · tijd handmatig`;
  return read;
}
