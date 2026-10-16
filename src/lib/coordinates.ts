import { fromRD } from '@/lib/rd';

export type Parsed = { lng: number; lat: number };

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Two numbers joined by a single comma and nothing else, e.g. "155000,463000" or "52.1,4.3". */
const COMMA_PAIR = /^\s*([-+]?\d+(?:\.\d+)?),([-+]?\d+(?:\.\d+)?)\s*$/;
/** A side that can't be the fraction of a decimal comma: an RD-like integer (4+ digits) or a number with a dot. */
const PAIR_SIDE = /^[-+]?\d{4,}$|\./;

/**
 * Resolve commas between digits: a decimal comma ("52,1 4,3" → "52.1 4.3"), unless the comma can only be the pair
 * separator: one comma, no other separator, and both sides RD-like integers or numbers with a dot
 * ("155000,463000" → "155000 463000", "52.1,4.3" → "52.1 4.3").
 */
export function normalizeCommas(input: string): string {
  const pair = input.match(COMMA_PAIR);
  if (pair && PAIR_SIDE.test(pair[1]) && PAIR_SIDE.test(pair[2])) return `${pair[1]} ${pair[2]}`;
  return input.replace(/(\d),(\d)/g, (_m, a, b) => `${a}.${b}`);
}

/**
 * Parse a single DMS token like:
 * - "52°22'30\"N"
 * - "4 53 0 E"
 * - "52.5N"
 * - "4°53'E"
 * Returns decimal degrees (signed) or null.
 */
export function parseDMS(token: string, isLatGuess?: boolean): number | null {
  const s = token
    .trim()
    .replace(/[^\d.,NSEW\-+°'″" ]/gi, ' ') // strip weird chars, keep N/E/S/W and DMS marks
    .replace(/[″"]/g, '"')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ');

  const hemiMatch = s.match(/[NSEW]/i);
  const hemi = hemiMatch ? hemiMatch[0].toUpperCase() : undefined;

  // Replace decimal commas between digits with dots
  const norm = s.replace(/(\d),(\d)/g, (_m, a, b) => `${a}.${b}`);

  // Extract numbers (deg, min, sec) in order
  const nums = (norm.match(/[-+]?\d+(?:\.\d+)?/g) || []).map(Number);
  if (nums.length === 0) return null;

  const deg = nums[0];
  const min = nums.length > 1 ? nums[1] : 0;
  const sec = nums.length > 2 ? nums[2] : 0;

  // A single number is already decimal degrees
  let dec = Math.abs(deg) + Math.abs(min) / 60 + Math.abs(sec) / 3600;

  // Sign by hemisphere or original sign
  if (hemi === 'S' || hemi === 'W') dec = -dec;
  if (!hemi && deg < 0) dec = -dec;

  // Basic sanity check
  const maxAbs = isLatGuess ? 90 : 180;
  if (Math.abs(dec) > maxAbs) return null;

  return dec;
}

/**
 * Try to parse two DMS-ish tokens into lat/lng (order-agnostic via hemisphere).
 * If hemisphere letters exist, uses them; otherwise falls back to guess order: lat first, then lon.
 */
function tryParseDMSPair(a: string, b: string): Parsed | null {
  const hasHemiA = /[NSEW]/i.test(a);
  const hasHemiB = /[NSEW]/i.test(b);

  const candAasLat = parseDMS(a, true);
  const candBasLng = parseDMS(b, false);
  const candAasLng = parseDMS(a, false);
  const candBasLat = parseDMS(b, true);

  // If hemispheres guide the order, prefer that
  if (hasHemiA || hasHemiB) {
    const aLat = /[NS]/i.test(a);
    const bLat = /[NS]/i.test(b);
    if (aLat && candAasLat != null && candBasLng != null) return { lat: candAasLat, lng: candBasLng };
    if (bLat && candBasLat != null && candAasLng != null) return { lat: candBasLat, lng: candAasLng };
  }

  // Fallback: assume a=lat, b=lng
  if (candAasLat != null && candBasLng != null) return { lat: candAasLat, lng: candBasLng };
  // Or a=lng, b=lat
  if (candAasLng != null && candBasLat != null) return { lat: candBasLat, lng: candAasLng };

  return null;
}

/**
 * Normalize a free-text coordinate string into two tokens that we can parse.
 * - Handles decimal commas
 * - Accepts separators: space, comma, semicolon, slash, pipe
 * - Keeps N/E/S/W and DMS marks
 */
export function tokenizePair(input: string): string[] {
  // First, convert decimal commas inside numbers to dots
  let s = normalizeCommas(input);

  // Replace the remaining separators with spaces
  s = s.replace(/[;|/]+/g, ' ');
  // Keep commas as separators now
  s = s.replace(/,/g, ' ');

  // Squash repeated whitespace
  s = s.replace(/\s+/g, ' ').trim();

  const parts = s.split(' ');

  // If we can detect two sides by presence of N/E/S/W, split after the first hemisphere marker
  const idx = parts.findIndex((p) => /[NSEW]$/i.test(p) || /^[NSEW]/i.test(p));
  if (idx > 0 && idx < parts.length - 1) {
    const left = parts.slice(0, idx + 1).join(' ');
    const right = parts.slice(idx + 1).join(' ');
    return [left, right];
  }

  // Otherwise, split into two halves by count
  if (parts.length >= 2) {
    const mid = Math.floor(parts.length / 2);
    return [parts.slice(0, mid).join(' '), parts.slice(mid).join(' ')];
  }

  return [s]; // single token (bad), handled by the caller
}

/**
 * Parse a user input string into WGS84 {lng, lat}.
 * Supports:
 * - WGS84 decimal: "52.123 4.321", "52,123; 4,321", "N52.1 E4.3", "4.3, 52.1" (auto order)
 * - WGS84 DMS: "52°22'30\"N 4°53'0\"E", "52 22 30 N, 4 53 0 E"
 * - RD: "155000 463000", "155000,463000", etc.
 */
export function parseToWGS84(input: string): Parsed | null {
  if (!input || !input.trim()) return null;

  const tokens = tokenizePair(input);

  // 1) DMS attempt
  if (tokens.length >= 2 && /[°'″"NSEW]/i.test(input)) {
    const dms = tryParseDMSPair(tokens[0], tokens[1]);
    if (dms) return { lng: dms.lng, lat: dms.lat };
  }

  // 2) Decimal / RD attempt
  const numeric = normalizeCommas(input).replace(/[^\d.\-+ ,;|/]/g, ' ');

  const nums = (numeric.match(/[-+]?\d+(?:\.\d+)?/g) || []).map(Number);
  if (nums.length < 2) return null;

  const a = nums[0];
  const b = nums[1];

  const isLatLonAB = Math.abs(a) <= 90 && Math.abs(b) <= 180;
  const isLonLatAB = Math.abs(a) <= 180 && Math.abs(b) <= 90;

  // Only one order is valid
  if (isLatLonAB && !isLonLatAB) return { lng: b, lat: a };
  if (!isLatLonAB && isLonLatAB) return { lng: a, lat: b };
  // Both orders are valid: assume the typical user order, lat lon
  if (isLatLonAB && isLonLatAB) return { lng: b, lat: a };

  // RD: [x, y] in meters. Any pair of large numbers is converted; points far
  // outside the RD grid end up outside the Netherlands and get rejected there.
  if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) > 10000 && Math.abs(b) > 10000) {
    try {
      const [lng, lat] = fromRD(a, b);
      return { lng: clamp(lng, -180, 180), lat: clamp(lat, -90, 90) };
    } catch {
      /* ignore */
    }
  }

  return null;
}
