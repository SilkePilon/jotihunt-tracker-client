/**
 * Rijksdriehoeksmeting (RD New, EPSG:28992) <-> WGS84, without proj4 (~35 KB gzip on the map's critical path).
 *
 * A direct port of what proj4 does for
 *   +proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel
 *   +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs
 * i.e. the oblique stereographic projection on the Bessel ellipsoid (via the Gauss conformal sphere) plus a 7-parameter
 * Helmert datum shift through geocentric coordinates. rd.test.ts checks it against proj4 over a grid covering the
 * Netherlands (agreement far below a millimetre).
 */

/** Bounds of the RD grid over the Netherlands (metres): x 0–290 km, y 290–630 km. */
export const RD_BOUNDS = { minX: 0, maxX: 290_000, minY: 290_000, maxY: 630_000 } as const;

const D2R = Math.PI / 180;
const HALF_PI = Math.PI / 2;
const FORTPI = Math.PI / 4;
const SEC_TO_RAD = Math.PI / 180 / 3600;

// Ellipsoids: a and es = (a² - b²) / a² with b = a (1 - 1/rf), as proj4 derives them
function ellipsoid(a: number, rf: number) {
  const b = (1 - 1 / rf) * a;
  const es = (a * a - b * b) / (a * a);
  return { a, b, es, e: Math.sqrt(es) };
}
const BESSEL = ellipsoid(6377397.155, 299.1528128);
const WGS84 = ellipsoid(6378137, 298.257223563);

// Helmert parameters Bessel -> WGS84 (translation m, rotation arcsec -> rad, scale ppm -> factor)
const DX = 565.417;
const DY = 50.3319;
const DZ = 465.552;
const RX = -0.398957 * SEC_TO_RAD;
const RY = 0.343988 * SEC_TO_RAD;
const RZ = -1.8774 * SEC_TO_RAD;
const M = 4.0725 / 1_000_000 + 1;

// Oblique stereographic (proj4 `sterea` + `gauss`)
const LAT0 = 52.15616055555555 * D2R;
const LON0 = 5.38763888888889 * D2R;
const K0 = 0.9999079;
const X0 = 155000;
const Y0 = 463000;

const srat = (esinp: number, exp: number) => ((1 - esinp) / (1 + esinp)) ** exp;

const GAUSS = (() => {
  const { es, e } = BESSEL;
  const sphi = Math.sin(LAT0);
  const cphi2 = Math.cos(LAT0) ** 2;
  const rc = Math.sqrt(1 - es) / (1 - es * sphi * sphi);
  const C = Math.sqrt(1 + (es * cphi2 * cphi2) / (1 - es));
  const phic0 = Math.asin(sphi / C);
  const ratexp = 0.5 * C * e;
  const K = Math.tan(0.5 * phic0 + FORTPI) / (Math.tan(0.5 * LAT0 + FORTPI) ** C * srat(e * sphi, ratexp));
  return { C, phic0, ratexp, K, R2: 2 * rc, sinc0: Math.sin(phic0), cosc0: Math.cos(phic0) };
})();

/** Longitude difference wrapped into -π..π (proj4 adjust_lon) */
function adjustLon(x: number): number {
  return Math.abs(x) <= Math.PI ? x : x - Math.sign(x) * 2 * Math.PI * Math.round(Math.abs(x) / (2 * Math.PI));
}

function geodeticToGeocentric(lon: number, lat: number, h: number, { a, es }: typeof BESSEL) {
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const rn = a / Math.sqrt(1 - es * sinLat * sinLat);
  return { x: (rn + h) * cosLat * Math.cos(lon), y: (rn + h) * cosLat * Math.sin(lon), z: (rn * (1 - es) + h) * sinLat };
}

/** Geocentric to geodetic [lon, lat] in radians (proj4's iterative Hannover algorithm) */
function geocentricToGeodetic(x: number, y: number, z: number, { a, es }: typeof BESSEL): [number, number] {
  const genau2 = 1e-24;
  const p = Math.sqrt(x * x + y * y);
  const rr = Math.sqrt(x * x + y * y + z * z);
  const lon = Math.atan2(y, x);
  const ct = z / rr;
  const st = p / rr;
  let rx = 1 / Math.sqrt(1 - es * (2 - es) * st * st);
  let cphi0 = st * (1 - es) * rx;
  let sphi0 = ct * rx;
  let cphi: number;
  let sphi: number;
  let sdphi: number;
  let iter = 0;
  do {
    iter++;
    const rn = a / Math.sqrt(1 - es * sphi0 * sphi0);
    const height = p * cphi0 + z * sphi0 - rn * (1 - es * sphi0 * sphi0);
    const rk = (es * rn) / (rn + height);
    rx = 1 / Math.sqrt(1 - rk * (2 - rk) * st * st);
    cphi = st * (1 - rk) * rx;
    sphi = ct * rx;
    sdphi = sphi * cphi0 - cphi * sphi0;
    cphi0 = cphi;
    sphi0 = sphi;
  } while (sdphi * sdphi > genau2 && iter < 30);
  return [lon, Math.atan(sphi / Math.abs(cphi))];
}

/** WGS84 longitude/latitude to RD metres (unrounded). */
export function toRD(lng: number, lat: number): { x: number; y: number } {
  // WGS84 geocentric -> Bessel geocentric (inverse Helmert)
  const g = geodeticToGeocentric(lng * D2R, lat * D2R, 0, WGS84);
  const xt = (g.x - DX) / M;
  const yt = (g.y - DY) / M;
  const zt = (g.z - DZ) / M;
  const [lonB, latB] = geocentricToGeodetic(xt + RZ * yt - RY * zt, -RZ * xt + yt + RX * zt, RY * xt - RX * yt + zt, BESSEL);

  // Gauss sphere, then the stereographic plane
  const { C, K, ratexp, R2, sinc0, cosc0 } = GAUSS;
  const lonS = C * adjustLon(lonB - LON0);
  const latS = 2 * Math.atan(K * Math.tan(0.5 * latB + FORTPI) ** C * srat(BESSEL.e * Math.sin(latB), ratexp)) - HALF_PI;
  const sinc = Math.sin(latS);
  const cosc = Math.cos(latS);
  const cosl = Math.cos(lonS);
  const k = (K0 * R2) / (1 + sinc0 * sinc + cosc0 * cosc * cosl);
  return {
    x: BESSEL.a * k * cosc * Math.sin(lonS) + X0,
    y: BESSEL.a * k * (cosc0 * sinc - sinc0 * cosc * cosl) + Y0,
  };
}

/** RD metres to WGS84 [longitude, latitude]. */
export function fromRD(x: number, y: number): [number, number] {
  const { C, K, R2, sinc0, cosc0, phic0 } = GAUSS;
  // Stereographic plane -> Gauss sphere
  const px = (x - X0) / BESSEL.a / K0;
  const py = (y - Y0) / BESSEL.a / K0;
  const rho = Math.hypot(px, py);
  let lonS = 0;
  let latS = phic0;
  if (rho) {
    const c = 2 * Math.atan2(rho, R2);
    const sinc = Math.sin(c);
    const cosc = Math.cos(c);
    latS = Math.asin(cosc * sinc0 + (py * sinc * cosc0) / rho);
    lonS = Math.atan2(px * sinc, rho * cosc0 * cosc - py * sinc0 * sinc);
  }
  // Gauss sphere -> Bessel ellipsoid (iterative)
  const lonB = adjustLon(lonS / C + LON0);
  const num = (Math.tan(0.5 * latS + FORTPI) / K) ** (1 / C);
  let latB = latS;
  for (let i = 20; i > 0; i--) {
    const next = 2 * Math.atan(num * srat(BESSEL.e * Math.sin(latB), -0.5 * BESSEL.e)) - HALF_PI;
    const done = Math.abs(next - latB) < 1e-14;
    latB = next;
    if (done) break;
  }

  // Bessel geocentric -> WGS84 geocentric (Helmert) -> WGS84 geodetic
  const g = geodeticToGeocentric(lonB, latB, 0, BESSEL);
  const [lon, lat] = geocentricToGeodetic(
    M * (g.x - RZ * g.y + RY * g.z) + DX,
    M * (RZ * g.x + g.y - RX * g.z) + DY,
    M * (-RY * g.x + RX * g.y + g.z) + DZ,
    WGS84,
  );
  return [lon / D2R, lat / D2R];
}

/** Whether x/y lie within the RD grid over the Netherlands (inclusive bounds). */
export function isPlausibleRD(x: number, y: number): boolean {
  return Number.isFinite(x) && Number.isFinite(y) && x >= RD_BOUNDS.minX && x <= RD_BOUNDS.maxX && y >= RD_BOUNDS.minY && y <= RD_BOUNDS.maxY;
}
