# Fox reach: growing walking area + direction cone

Date: 2026-10-20. Feature 2 of 5 from the GitHub scan (growing circle + speed estimate, cone toward unvisited groups
from Amalgama). Mockup: `.superpowers/brainstorm/75335-1792479927/content/reach-look-v2.html`, option **A** picked.

## Goal

A rule-based complement to the AI prediction: for every fox, the area it can have walked to since its last known
spot, growing live, along real paths (closed woods at night), at the speed this fox actually walks. A darker cone
inside that area points at the nearest group the fox has not visited yet this round.

## Behaviour

### Layer

- New map layer **"Bereik vossen"** in the layers panel (group with Voorspelling), off by default (`showReach`).
- One shape per visible area (`useAreas().isVisible`), skipping areas that are not huntable (`isForbidden`, same as
  Predictions; OV/blue is not walking).
- Look A: area filled in the fox colour (`getColorFromArea`) at 0.12, dashed 2 px outline; cone in the same colour
  at 0.22, only inside the area; the last spot as a dot; a chip next to it: `Alpha · 52 min · 4,6 km/u`
  (`~5 km/u` when the speed is an estimate, `3u+` instead of minutes once the cap is reached).
- Minutes on the chip tick every minute on the client from `fix.at`; the shape itself comes from the server.
- Animations: shapes fade in/out with paint opacity transitions; chips enter/exit with motion (fade + scale).
- Layer order: with the prediction areas (below trails and markers, above the base map).

### Last spot

Newest marker of type `hint` or `hunt` for the area (same rule as the hint wildcard's `lastFoxFix`). No marker: no
shape for that area.

### Speed (per fox)

- Pairs = consecutive hint/hunt markers of the area in the last 6 hours, each pair a leg.
- When routed trails are enabled, use the trails service's legs: only `mode: "walk"` legs count, with their routed
  `distanceM` (straight distance × 1.2 when the leg has no route). Without trails: straight distance × 1.2 for every
  leg, and legs faster than 8 km/h are treated as car moves and skipped.
- A leg is skipped when: shorter than 10 minutes, or the fox was red for more than 30 minutes during it
  (`AreaStatusEvent` intervals, `statusIntervals` from `trail-legs.ts`).
- Speed = median of the remaining legs' km/h, clamped to 3–7 km/h. Fewer than 2 usable legs: 5 km/h, `measured:
  false`.

### Area

- Distance = speed × time since the last spot, capped at 3 hours of walking (`capped: true`).
- GraphHopper `GET /isochrone?point=lat,lng&distance_limit=…&profile=…&buckets=1`.
- Profile: `foot` by day, `foot_night` when it is night now at the fix (`isNightAt` from `routes/sun.ts`).
  `foot_night` is a new router profile: `custom_model_files: [foot.json, foot_night.json]` where `foot_night.json`
  sets priority 0 for `foot_temporal_access == NO` (the OSM night closures `prepare_night.py` already writes). Admin
  drawn night areas are not applied to the area (the GET isochrone takes no custom model); they still apply to
  trails. Adding the profile needs one graph rebuild through the supervisor.
- Router missing, down, or no polygon: a turf circle with the same radius, `estimate: true`.
- Polygon simplified (turf `simplify`, ~15 m tolerance) before sending.

### Cone

- Groups = teams of the same area. Unvisited = not visited in the current round (`listCurrentVisits`: manual
  override, otherwise the AI's visited list).
- Target = nearest unvisited group by straight distance from the last spot. None: no cone.
- Cone = a ±30° sector from the last spot toward the target, radius large enough to cover the area, intersected
  with the area polygon on the server (turf `intersect`). Empty intersection: no cone.

### Refresh

- Server memoises the whole response for 30 seconds (new markers, visits and status show up within that); the area
  grows in 100 m steps, isochrones cached in memory per `fixId|profile|distance`.
- Client: SWR `/reach`, refresh every 60 s, only while the layer is on.

## API

`GET /api/reach` (`verifyToken`):

```ts
interface ReachResponse { enabled: boolean; areas: AreaReach[] }
interface AreaReach {
  area: string;
  fix: { id: string; type: 'hint' | 'hunt'; at: string; lng: number; lat: number };
  speedKmh: number; measured: boolean; legs: number;
  distanceM: number; capped: boolean; night: boolean; estimate: boolean;
  polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  cone: { teamApiId: number; name: string; bearing: number; distanceM: number; polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon } | null;
}
```

The endpoint always answers (circle fallback without a router); `enabled` is always `true` for now, reserved for a
kill switch.

## Structure

Server (`jotihunt-tracker-server`):
- `router/config.yml`: profile `foot_night`, `custom_models.directory`; `router/custom_models/foot_night.json`;
  Dockerfile copies it.
- `src/services/routes/graphhopper.client.ts`: `isochrone({profile, point, distanceM})` on the router interface.
- `src/services/reach/speed.ts` (pure): `measureSpeed(legs, statusEvents, now)`.
- `src/services/reach/cone.ts` (pure): `nearestUnvisited(fix, groups, visitedIds)`, `coneSector(...)`, clip.
- `src/services/reach/reach.service.ts`: gathers markers, trails legs, status events, teams, visits; memo; router
  calls with circle fallback.
- `src/controllers/reach.controller.ts` + `src/routes/reach.route.ts`, mounted in `app.ts`.

Client (`jotihunt-tracker-client`):
- `src/hooks/reach.hook.ts` (SWR), types in `src/lib/reach.ts` (feature builders, chip text, pure + tested).
- `src/components/layers/Reach.tsx`: source + fill/line layers for area and cone, fix dots + chips as `Marker`s.
- `src/lib/map-layers.ts`: layer ids in `MAP_LAYER_STACK` next to the prediction areas.
- `layers.store.ts`: `showReach` (default false) + toggle; layers panel row "Bereik vossen".
- `Map.tsx`: `{showReach && !wall && <Reach />}`.

## Error handling

- Router errors never fail the request: circle fallback per area, logged once per cooldown.
- No markers / no teams / no visits: the parts that need them are skipped.

## Testing

- Server unit: speed (median, clamp, red skip, short skip, car skip, fallback 5), cap, cone choice (visited
  skipped, other area skipped, none), sector clip, isochrone client (fake post: query, errors), service fallback to
  circle, memo invalidation.
- Client unit: chip text (minutes, `3u+`, `~`), feature building.
- Router: build locally or on the cluster, check `foot_night` isochrone answers.
- Browser: fake API with `/reach` fixture, desktop + phone, light + dark.

## Out of scope

Admin night areas inside the isochrone, per-fox speed override, Android app, pushing the area to the HQ screen.
