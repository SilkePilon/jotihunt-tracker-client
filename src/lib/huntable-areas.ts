/**
 * Rule 5.1: before the game each group hears which fox teams it may hunt; hunts on other teams score 0. Our own
 * (hoofd) fox team is the area of our home team; the others an admin sets team-wide (`/settings/huntable-areas`).
 */

/** Answer of GET /settings/huntable-areas: lowercase areas allowed besides our own, null when not configured. */
export interface HuntableAreasSetting {
  areas: string[] | null;
}

/** Tooltip / aria-label note for a fox we may not hunt. */
export const FORBIDDEN_AREA_NOTE = 'niet toegestaan voor onze groep (0 punten)';

/**
 * Whether hunting `area` scores 0 for us. Not configured or still loading (`allowed` null / undefined): nothing is
 * forbidden. Our own area never is. Case-insensitive ("Alpha" from /areas and /teams, "alpha" from /markers).
 */
export function isForbiddenArea(area: string, ownArea: string | undefined, allowed: string[] | null | undefined): boolean {
  if (!allowed) return false;
  const key = area.trim().toLowerCase();
  if (ownArea !== undefined && key === ownArea.trim().toLowerCase()) return false;
  return !allowed.includes(key);
}
