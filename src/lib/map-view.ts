/** The map's start view: the whole Jotihunt play area. */
export const DEFAULT_VIEW = {
  latitude: 52.1209259,
  longitude: 5.6869246,
  zoom: 9.5,
};

/** Below these the map counts as north-up and flat (float noise after an ease, a hair of twist while pinching) */
const BEARING_EPSILON_DEG = 1;
const PITCH_EPSILON_DEG = 0.5;

/** Whether the map is turned or tilted, so the reset-north tile shows (bearing in −180…180, pitch in degrees). */
export function isRotated(bearing: number, pitch: number): boolean {
  return Math.abs(bearing) > BEARING_EPSILON_DEG || pitch > PITCH_EPSILON_DEG;
}
