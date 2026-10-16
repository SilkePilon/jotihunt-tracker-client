import { formatClock, formatCountdown } from '@/lib/format';
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

/** Time the hunt must be submitted (photo) or confirmed (QR) on jotihunt.nl, counted from the hunt time. */
export const SUBMIT_WINDOW_MS = 15 * 60 * 1000;

/** The report has a photo (code read from the sticker, HQ submits). Older servers don't send hasPhoto: then always. */
export function reportHasPhoto(report: Pick<HuntReport, 'hasPhoto'>): boolean {
  return report.hasPhoto !== false;
}

/** QR hunt: reported without a photo, the hunter confirms it on jotihunt.nl by scanning the fox's QR code. */
export const isQrHunt = (report: Pick<HuntReport, 'hasPhoto'>) => !reportHasPhoto(report);

export function huntStatusLabel(report: HuntReport): string {
  switch (report.status) {
    case 'to_submit':
      return isQrHunt(report) ? 'Bevestigen' : 'Te versturen';
    case 'overdue':
      return 'Te laat!';
    case 'submitted':
      return isQrHunt(report) ? 'Bevestigd' : 'Ingestuurd';
    case 'judged':
      return report.site?.status || 'Beoordeeld';
  }
}

/** Status of a report right now: the server status is from the last poll, so flip to overdue locally when the deadline passes in between. */
export function currentHuntStatus(report: HuntReport, now: number): HuntReport['status'] {
  return report.status === 'to_submit' && new Date(report.deadline).getTime() < now ? 'overdue' : report.status;
}

/** The status text of a report changes every second (the "Te versturen · 08:42" countdown) until its deadline passes. */
export function hasLiveCountdown(report: HuntReport, now: number): boolean {
  return report.status === 'to_submit' && !isReading(report) && new Date(report.deadline).getTime() > now;
}

/** Reports still waiting for jotihunt.nl: HQ has to submit them, or (QR hunts) the hunter has to confirm them. */
export function pendingReports(reports: HuntReport[] | undefined): HuntReport[] {
  return (reports ?? []).filter((report) => report.status === 'to_submit' || report.status === 'overdue');
}

/** Collapsed sidebar summary: "2 te versturen", "1 te bevestigen" (QR hunts), "3 open" (both), or "5 hunts · 42 pt". */
export function huntsSummary(reports: HuntReport[] | undefined): string | undefined {
  if (!reports) return undefined;
  const pending = pendingReports(reports);
  if (pending.length) {
    const qr = pending.filter(isQrHunt).length;
    const word = qr === pending.length ? 'te bevestigen' : qr === 0 ? 'te versturen' : 'open';
    return `${pending.length} ${word}`;
  }
  const points = reports.reduce((sum, report) => sum + (report.site?.points ?? 0), 0);
  return `${reports.length} hunts · ${points} pt`;
}

/** A report without code links to a scraped hunt of its area at most this far from its hunt time (same rule as the server). */
const TIME_LINK_MS = 15 * 60 * 1000;

/**
 * Scraped hunts that belong to a report, mirroring the server's linking: by normalised code first; otherwise a report
 * without code that the server linked (it has a site result) takes the scraped hunt of its area closest to its hunt
 * time within ±15 min (QR hunts have no code). Each scraped hunt belongs to at most one report.
 */
export function linkedHuntIds(reports: HuntReport[] | undefined, hunts: Hunt[] | undefined): Set<string> {
  const codes = new Set((reports ?? []).flatMap((report) => (report.huntCode ? [report.huntCode] : [])));
  const linked = new Set((hunts ?? []).filter((hunt) => hunt.huntCode && codes.has(normalizeHuntCode(hunt.huntCode))).map((hunt) => hunt._id));
  const pairs: { reportId: string; huntId: string; diff: number }[] = [];
  for (const report of reports ?? []) {
    if (report.huntCode || !report.site) continue;
    const time = new Date(report.huntTime).getTime();
    for (const hunt of hunts ?? []) {
      if (linked.has(hunt._id) || (hunt.huntCode && codes.has(normalizeHuntCode(hunt.huntCode)))) continue;
      if (hunt.area.trim().toLowerCase() !== report.area.toLowerCase()) continue;
      const diff = Math.abs(new Date(hunt.huntTime).getTime() - time);
      if (diff <= TIME_LINK_MS) pairs.push({ reportId: report._id, huntId: hunt._id, diff });
    }
  }
  // Closest pairs first; every report and every scraped hunt is used once
  const usedReports = new Set<string>();
  for (const pair of pairs.sort((a, b) => a.diff - b.diff)) {
    if (usedReports.has(pair.reportId) || linked.has(pair.huntId)) continue;
    usedReports.add(pair.reportId);
    linked.add(pair.huntId);
  }
  return linked;
}

/** Own reports plus scraped jotihunt.nl hunts that belong to no report (see {@link linkedHuntIds}).
 * Note: report.huntCode is already normalised by the server. */
export function huntListItems(reports: HuntReport[] | undefined, hunts: Hunt[] | undefined): HuntListItem[] {
  const linked = linkedHuntIds(reports, hunts);
  const websiteOnly = (hunts ?? []).filter((hunt) => !linked.has(hunt._id));
  return [...(reports ?? []).map((report) => ({ source: 'app' as const, report })), ...websiteOnly.map((hunt) => ({ source: 'website' as const, hunt }))];
}

/** {@link formatClock}, but "–" for a missing or invalid time (scraped jotihunt.nl hunts can lack one). */
export function formatHuntTimeSafe(time: Date | string | null | undefined): string {
  if (!time) return '–';
  const date = new Date(time);
  return Number.isNaN(date.getTime()) ? '–' : formatClock(date);
}

/** The server is still reading the code and time from the photo (never for QR hunts). */
export function isReading(report: HuntReport): boolean {
  return reportHasPhoto(report) && (report.ocrStatus === 'pending' || report.ocrStatus === 'reading');
}

/** "14:05", or "±14:05" (the upload time) while the time on the photo is not known yet. */
export function huntTimeLabel(report: HuntReport): string {
  return `${huntTimeKnown(report) ? '' : '±'}${formatClock(report.huntTime)}`;
}

/** The hunt time is real: read/entered, or a QR hunt (the time the hunter tapped "Hunt melden"). */
export function huntTimeKnown(report: Pick<HuntReport, 'huntTimeKnown' | 'hasPhoto'>): boolean {
  return report.huntTimeKnown || isQrHunt(report);
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
  if (isQrHunt(report)) return 'Gemeld zonder foto';
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

/** Points of a hunt list: the jotihunt.nl result of own reports, plus website-only hunts. */
export function totalPoints(items: HuntListItem[]): number {
  return items.reduce((sum, item) => sum + (item.source === 'app' ? (item.report.site?.points ?? 0) : item.hunt.points), 0);
}

/** Second line of a timeline entry: what the report is waiting for, e.g. "te versturen", "te bevestigen" or "deadline verstreken". */
export function huntStatusSentence(report: HuntReport, now: number): string {
  if (isReading(report)) return 'wordt gelezen';
  const qr = isQrHunt(report);
  switch (currentHuntStatus(report, now)) {
    case 'to_submit':
      return qr ? 'te bevestigen' : 'te versturen';
    case 'overdue':
      return 'deadline verstreken';
    case 'submitted':
      return qr ? 'bevestigd' : 'ingestuurd';
    case 'judged':
      return report.site?.status ? report.site.status.toLowerCase() : 'beoordeeld';
  }
}

/** Right-hand status of a timeline entry: "nog 8:42", "Te laat!", "Ingestuurd" or "+250 pt". */
export function huntTimelineStatus(report: HuntReport, now: number): string {
  switch (currentHuntStatus(report, now)) {
    case 'to_submit':
      return `nog ${formatCountdown(new Date(report.deadline).getTime() - now)}`;
    case 'overdue':
      return 'Te laat!';
    case 'submitted':
      return isQrHunt(report) ? 'Bevestigd' : 'Ingestuurd';
    case 'judged':
      return report.site?.points ? `+${report.site.points} pt` : report.site?.status || 'Beoordeeld';
  }
}
