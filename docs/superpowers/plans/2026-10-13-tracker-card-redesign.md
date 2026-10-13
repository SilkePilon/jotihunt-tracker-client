# Tracker Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the busy "Mijn tracker" sidebar card with a calm five-state card (idle / pairing / connected / no signal / collapsed) built around a flat green cookie check badge, and use the same cookie check on visited group pins on the map.

**Architecture:** One pure helper (`src/lib/cookie-shape.ts`) generates the Android `cookie` shape for both the SVG badge and the map's canvas painter. A pure `trackerView()` picks the state; `TrackerCard` renders one small view component per state. No server/API changes.

**Tech Stack:** React 19, TypeScript, Tailwind v4, shadcn/ui (Radix dropdown), MapLibre canvas images, `bun test`.

Spec: `docs/superpowers/specs/2026-10-13-tracker-card-redesign-design.md`

## Global Constraints

- Client only; hooks `useTrackerStatus`, `usePairingCode`, `useAppRelease` and the server API stay unchanged.
- Badge: flat, no glow/shadow. Green `fill-green-500` (ok), amber `fill-amber-500` (warn).
- Cookie: 9 lobes, r(θ) = R · (1 − d · (1 + cos 9θ) / 2); map hunt marker keeps d = 0.07; badges use d = 0.15.
- Dutch copy exactly as in the spec ("Koppel je telefoon", "Verbonden", "Geen signaal", "wijzig", "Staat de app nog aan?", "Op de fiets", …).
- Keep `data-tracker-state` on every view root.
- Tests: `npx --yes bun test`; lint `npx --yes bun run lint`; build `npx --yes bun run build`.

---

### Task 1: Shared cookie shape + map uses it + visited badge

**Files:**
- Create: `src/lib/cookie-shape.ts`, `src/lib/cookie-shape.test.ts`
- Modify: `src/components/layers/marker-icons.ts` (`Painter.cookie`, `badged`, `case 'group'`)

**Interfaces:**
- Produces: `COOKIE_LOBES`, `MARKER_COOKIE_DEPTH = 0.07`, `BADGE_COOKIE_DEPTH = 0.15`,
  `cookiePoints(cx, cy, radius, depth, steps = 180): [number, number][]`, `cookiePath(size, depth): string`.

- [ ] Step 1: tests — path starts with `M` and ends with `Z`; every point lies within `[R(1−d), R]` of the centre; the
  radius has 9 maxima over a full turn.
- [ ] Step 2: run, expect FAIL (module missing).
- [ ] Step 3: implement `cookie-shape.ts`; `Painter.cookie(cx, cy, radius, color, depth = MARKER_COOKIE_DEPTH)` uses
  `cookiePoints`; `badged(size, shape, badge?, base: 'round' | 'cookie' = 'round')` draws the rim as a cookie when
  `base === 'cookie'`; visited group badge = `p.cookie(cx, cy, BADGE / 2 - 1.5, palette.ok, BADGE_COOKIE_DEPTH)` +
  check glyph, with `base: 'cookie'`.
- [ ] Step 4: tests pass.
- [ ] Step 5: commit `feat(map): cookie check badge on visited group pins`.

### Task 2: `trackerView`, summary, vehicle phrases

**Files:** Modify `src/lib/tracker.ts`, `src/lib/tracker.test.ts`

**Interfaces:**
- Produces: `type TrackerView = 'loading' | 'error' | 'not-configured' | 'idle' | 'pairing' | 'connected' | 'no-signal'`,
  `trackerView(status: TrackerMe | undefined, isError: boolean, pairing: boolean): TrackerView`,
  `hasSignalLost(status): boolean`, `VEHICLE_OPTIONS[i].phrase`.

```ts
export function trackerView(status: TrackerMe | undefined, isError: boolean, pairing: boolean): TrackerView {
  if (!status) return isError ? 'error' : 'loading';
  if (!status.configured) return 'not-configured';
  if (pairing) return 'pairing';
  if (status.connected) return 'connected';
  return status.stats.lastUpdate ? 'no-signal' : 'idle';
}
```

- [ ] Step 1: tests for every view (incl. pairing over connected, no-signal only with `lastUpdate`, error only
  without status) and `trackerSummary` → "Geen signaal".
- [ ] Step 2: FAIL. Step 3: implement. Step 4: PASS.
- [ ] Step 5: commit `feat(tracker): trackerView and no-signal summary`.

### Task 3: New card components

**Files:**
- Create: `src/components/tracker/CookieBadge.tsx`, `VehicleMenu.tsx`, `TrackerIdle.tsx`, `TrackerPairing.tsx`,
  `TrackerLive.tsx`, `styles.ts`
- Rewrite: `src/components/tracker/TrackerCard.tsx`
- Delete: `AppPairingPanel.tsx`, `VehiclePicker.tsx`
- Modify: `src/components/sidebar/TrackerSection.tsx` (summary 4b), `src/components/tour/steps.ts` (tracker body)

**Interfaces:**
- `CookieBadge({ tone: 'ok' | 'warn', size: number, className? })`
- `VehicleMenu({ value: Vehicle, saving: boolean, onChange(vehicle) })`
- `TrackerIdle({ onPair(), onOpenGuide() })`
- `TrackerPairing({ pairing: PairingCode | null, creating, failed, onRetry(), onClose() })`
- `TrackerLive({ status: configured TrackerMe, savingVehicle, onVehicleChange, onRepair() })`
- `TrackerCard` props unchanged; owns `usePairingCode` and `pairingOpen`; closes pairing when `connected` goes
  false → true.

- [ ] Step 1: write the components per the spec (P3 pairing: desktop 96 px QR + code + countdown, mobile "Open in de
  Jotihunt-app" button; ✕ closes; expired/failed → "Nieuwe code"/"Opnieuw").
- [ ] Step 2: `TrackerSection` summary: text + 18 px `CookieBadge` (ok when connected, warn when signal lost).
- [ ] Step 3: tour copy: "Koppel je telefoon als GPS-tracker, zodat iedereen ziet waar je bent. Kies hier ook of je loopt, fietst of rijdt."
- [ ] Step 4: `bun test`, `lint`, `build` clean.
- [ ] Step 5: commit `feat(tracker): calmer Mijn tracker card with cookie badge`.

### Task 4: Verify in the browser

- [ ] Run `vite` dev server against the local API; check idle, pairing (desktop + mobile width), connected,
  no-signal, collapsed headers, vehicle menu, light + dark; visited group pin on the map.
- [ ] Fix anything found; commit.
