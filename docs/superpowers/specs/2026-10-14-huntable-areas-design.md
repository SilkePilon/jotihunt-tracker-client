# Huntbare vossen (allowed areas) — design

Date: 2026-10-14. Picked in the visual companion.

## Goal

Rule 5.1: before the game each group hears which fox teams it may hunt. Hunts on other teams score 0. The app must show
which foxes we may **not** hunt, team-wide, configured by an admin.

- Own (hoofd) fox team (6 pt) = the deelgebied of our own group: `useHomeTeam().area` (from the Jotihunt API `/subscriptions`
  `area`, or filled in by hand in the team popup when `TEAMS_AREA_EDITING`). Not a setting.
- Other allowed teams (3 pt) = a team-wide admin setting.
- Everything else = forbidden (0 pt).

## Setting (server)

- New global setting `huntable-areas`, stored in the REAL database `settings` collection (also in demo mode) and cached in
  memory — same pattern as `src/settings/prediction-setting.ts`.
- Value `{ areas: string[] | null }`: lowercase area names (`alpha` … `oscar`) that are allowed besides our own area.
  `null` (no document) = **not configured = every fox allowed**.
- `GET /settings/huntable-areas` (verifyToken) → `{ areas }`.
- `PUT /settings/huntable-areas` (verifyToken + isAdmin) body `{ areas: string[] }`; each entry must be one of the 9 area
  names (express-validator, Dutch message), duplicates removed, stored sorted. Logs who changed it.
- Unit tests for the setting module (init default null, set persists then caches, failed write leaves cache unchanged)
  and the validation.

## Rule (client, pure)

`src/lib/huntable-areas.ts`:
- `isForbiddenArea(area: string, ownArea: string | undefined, allowed: string[] | null | undefined): boolean`
  - `allowed` null/undefined (not configured / loading) → false (nothing forbidden).
  - own area (case-insensitive) → false.
  - otherwise → `!allowed.includes(area.toLowerCase())`.
- Unit tested (not configured, own area, allowed, forbidden, case-insensitivity, own area unknown).

Hook `useHuntableAreas()` (`src/hooks/huntable-areas.hook.ts`): SWR on `/settings/huntable-areas` (slow refresh like the
prediction setting) → `{ allowed, setAllowed, isForbidden(area) }` where `isForbidden` combines the setting with
`useHomeTeam()?.area`.

## Beheer → Algemeen

One flat card at the top of Algemeen, "Andere vossen die we mogen hunten" · "3 pt · de rest krijgt een slotje", count
`n/9` on the right (own area counted). Chips for every area except our own: allowed = check icon + area dot, light fill;
forbidden = lock icon, dimmed dot, muted text. Tap toggles and saves (optimistic, toast on error, rollback). Not
configured shows every chip as allowed; the first toggle stores the list. No "Alles toestaan" button (turning every chip
on is the same).

**Visual styling of this card follows the upcoming Beheer redesign**; build it after that direction is picked.

## Vossen card (option A)

- A forbidden fox stays in its status group; its chip is dimmed (≈45 %) and shows a **lock icon instead of the area dot**
  (icon swap pops, `lib/motion` POP). Combined with the map-hidden state the stronger dim wins.
- Its status-bar segment (full and mini bar) is dimmed and hatched.
- Tooltip/aria-label adds "· niet toegestaan voor onze groep (0 punten)".
- Counts and grouping unchanged.

## Map markers (M6)

- Spot, hunt and prediction markers of a forbidden area are drawn in the neutral roles (`surfaceContainerHighest` fill,
  `onSurfaceVariant` glyph, ~80 % opacity) with a **lock badge instead of the area letter**.
- Implementation: a `locked` flag in the fox/prediction `MarkerIconKey` (image id suffix, e.g. `fox|spot|green|alpha|locked`),
  a lock glyph in `marker-glyphs.ts`, parsing/round-trip tests in `marker-style.test.ts`. Features get the locked id when
  `isForbidden(area)`.
- Map images swap without animation (same as today's markers).

## Out of scope

Hint labels, group (house) pins, HQ screen, hunt registration warnings.

## Testing

Server: `npx --yes bun test` for the setting + route validation. Client: unit tests for `isForbiddenArea` and marker ids;
`tsc -b`, lint; browser check (vite :5174 vs prod) with a mocked setting: card dimming/lock, bar hatch, markers grey + lock,
Beheer card toggle.
