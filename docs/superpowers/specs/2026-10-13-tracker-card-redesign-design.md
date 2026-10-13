# "Mijn tracker" card redesign — Design

Date: 2026-10-13
Status: approved in brainstorm (visual companion mockups in `.superpowers/brainstorm/3076851-1791876566/content/`, final screen `final-flow-v2.html`)
Repo: `jotihunt-tracker-client` only (no server or API changes)

## Goal

The "Mijn tracker" sidebar section is too busy: a method toggle (Android-app / Traccar Client), download button,
pairing button, QR, code, countdown, a 4-button vehicle row, five stat rows, a guide button, "Opnieuw koppelen" and
"Klaar" — about twelve things to look at. The new card shows one clear thing per state with as few controls as
possible, and looks like the Android app (flat Material 3 Expressive cookie badge).

## States

The card has five states. Which one shows is a pure function of the tracker status plus local UI state
(`trackerView`, see Components).

### 1. Idle (configured, never reported or the user is not pairing)

- One muted sentence: "Deel je locatie met het team zodat iedereen ziet waar je bent."
- Primary large button "Koppel je telefoon" (phone icon). Click: create a pairing code (`usePairingCode().create`)
  and go to state 2.
- Link line (small, muted, centred): "Nog geen app? **Download (versionName)** · iPhone? **Traccar**".
  - "Download" is the APK link from `useAppRelease` (hidden part when `release` is null/undefined; then the line
    is only "iPhone? Traccar").
  - "Traccar" opens the existing `TrackerGuideDialog` (Traccar Client QR + steps), unchanged.

### 2. Pairing (P3, compact)

Shown after clicking "Koppel je telefoon" or "wijzig". Header row: bold small "Scan met de app" (desktop) /
"Koppel deze telefoon" (mobile) and a ✕ icon button that leaves pairing (back to state 1, or to 3/5 when re-pairing).

- Desktop: small QR (≈96 px, `TrackerQrCode` with the pairing URL) on the left; on the right "of typ", the code in
  large mono (`formatPairingCode`), and a spinner + countdown (`formatCountdown`).
- Mobile (`useIsMobile`): no QR (you can't scan your own screen). Primary button "Open in de Jotihunt-app"
  (pairing URL), below it "of typ CODE" left and spinner + countdown right.
- While the code is being created: spinner in place of the QR/button. On failure: the existing red text
  "Code maken is mislukt, probeer het opnieuw." plus a "Opnieuw" button.
- When the countdown hits 0: the code area is replaced by a "Nieuwe code" button (same behaviour as today).
- Leaving pairing automatically: when the status goes from not connected to connected while in state 2, the card
  switches to state 3. When re-pairing from state 3/5 there is no reliable "new phone" signal, so only ✕ leaves.

### 3. Connected

Centred column:

- Flat green Cookie 9-sided badge (72 px) with a white check mark. No shadow/glow.
- "Verbonden" (17 px, bold).
- Muted line "Live · {formatLastUpdate} · **wijzig**". "wijzig" is an underlined text button that starts
  re-pairing (state 2).
- Vehicle pill (T4): grey rounded pill "{icon} Op de fiets ▾" (walking: "Lopend", bike: "Op de fiets",
  car: "In de auto", motorcycle: "Op de motor"). Click opens a `DropdownMenu` with the four vehicles (icon + label,
  check on the current one). Choosing one calls the existing `setVehicle`; the pill is disabled with a spinner
  icon while saving; the existing error toast stays.

All stats rows (speed, battery, accuracy, distance) are removed.

### 4. Collapsed summary (section header, 4b)

- Connected: "Verbonden" followed by a 20 px green cookie check badge (replaces the green `Badge` pill).
- No signal: "Geen signaal" followed by a 20 px amber cookie "!" badge.
- Other states keep their text summaries ("Niet verbonden", "Niet ingesteld", "Niet bereikbaar").

### 5. No signal (new)

The server sets `connected: false` when Traccar received nothing for 5 minutes, which today drops the user back
to the pairing screen. New rule (client only): `configured && !connected && stats.lastUpdate` → "no signal".

- Same layout as state 3 with an amber cookie badge with "!", title "Geen signaal",
  line "Laatste locatie {formatLastUpdate} · **wijzig**", extra muted line "Staat de app nog aan?",
  and the vehicle pill.
- A device without any `lastUpdate` is state 1.
- `sectionTransition` keeps working on `connected`, so the section still opens when the signal drops and
  collapses once when it comes back.

### Unchanged

- Not configured / unreachable / group invalid: the existing `notConfiguredText` block.
- Loading skeleton and the "Trackerstatus kan niet worden geladen." error line.
- Server API, `useTrackerStatus`, `usePairingCode`, `useAppRelease`, `TrackerGuideDialog`, `TrackerQrCode`.

## Components

`src/components/tracker/`:

- `TrackerCard.tsx` — stays the entry point (same props); picks the view and renders one of the
  views below. Holds `pairing` UI state (`'off' | 'pairing'`).
- `TrackerIdle.tsx` — state 1.
- `TrackerPairing.tsx` — state 2 (replaces `AppPairingPanel.tsx`, which is deleted). Owns `usePairingCode` and
  the 1 s countdown interval; creates the code on mount.
- `TrackerLive.tsx` — states 3 and 5 (prop `variant: 'connected' | 'no-signal'`).
- `CookieBadge.tsx` — flat SVG cookie (9 lobes, amplitude 0.08) with `tone: 'ok' | 'warn'` and `size`; check mark
  for ok, "!" for warn. Path generated once by a pure helper.
- `VehicleMenu.tsx` — the pill + dropdown (replaces `VehiclePicker.tsx`, which is deleted).

`src/lib/tracker.ts`:

- `trackerView(status, isError, pairing): 'loading' | 'error' | 'not-configured' | 'idle' | 'pairing' | 'connected' | 'no-signal'`
  — pure, unit tested.
- `trackerSummary` gains the "Geen signaal" case.
- `cookiePath(lobes, amplitude, size)` — pure SVG path helper (in `src/lib/cookie-shape.ts`), unit tested for
  closed path / bounds.
- `VEHICLE_OPTIONS` gains a `phrase` ("Op de fiets", …) for the pill.
- The stat formatters (`formatSpeed`, `formatBattery`, …) stay: the admin Hunters panel and device popup use them.

`TrackerSection.tsx`: the summary uses `CookieBadge` (4b) instead of the green `Badge`.

`src/components/tour/steps.ts`: the tracker step body no longer mentions the step-by-step guide in the card:
"Koppel je telefoon als GPS-tracker, zodat iedereen ziet waar je bent. Kies hier ook of je loopt, fietst of rijdt."

Keep `data-tracker-state` on each view root (values: `not-configured`, `idle`, `pairing`, `connected`,
`no-signal`).

## Styling

Tailwind + existing tokens. Green badge `#22c55e` (`fill-green-500`), amber `fill-amber-500`, works in light and
dark. Primary button uses the theme `primary` (orange). Pill: `bg-muted` rounded-full. No glow or shadow on the
badge.

## Testing

- Unit (`bun test`): `trackerView` for every state including no-signal and re-pair; `trackerSummary` incl.
  "Geen signaal"; `cookiePath`.
- Manual in the browser (desktop + mobile width): idle → pairing → connected with the Android app; ✕; code
  expiry → "Nieuwe code"; vehicle change; no-signal after stopping the app for 5 minutes; light and dark mode;
  collapsed headers.
- `bun run lint` and `bun run build` clean.
