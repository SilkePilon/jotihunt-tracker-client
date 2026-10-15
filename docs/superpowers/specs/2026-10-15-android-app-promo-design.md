# Android-app promo popup — design

Date: 2026-10-15. Mockups (visual companion, project root `.superpowers/brainstorm/2210665-1792076408/content/`):
`android-app-popup.html` (picked **B**, "Dialoog met hero") and `android-popup-buttons.html` (picked buttons **2**,
"Split button").

## Goal

Phones on Android get a one-time popup that the native Jotihunt app exists. The popup downloads the APK, guides the
install, and pairs the app with the logged-in account in one flow, using a deep link instead of a QR code.

## When it shows

All conditions must hold:
- `useIsMobile()` is true, the user agent matches `/Android/i`, and the user is logged in (Layout routes only).
- The server has an APK: `useAppRelease().release` is an object. `null` means no APK; `undefined` means loading or failed.
- The user has no paired app device: `useAccount(true).overview.devices.length === 0`.
- `navigator.getInstalledRelatedApps?.()` does not report `nl.jotihunt.tracker`. This is progressive enhancement and
  is skipped when the API is missing.
- The stored state allows it (localStorage `jh-android-promo`, JSON `{ hiddenUntil?: number; never?: true }`):
  - "Later" sets `hiddenUntil = now + 3 days`.
  - "Niet meer tonen" and a successful pairing set `never: true`.
- No tour is active (`useTourStore().active`), and the Meldingen and Account dialogs are closed. If one is open, the
  popup waits until it closes. It opens 1.5 s after all conditions hold.

Manual entry: on Android, the mobile menu's "Jij" card gets an **"Android-app"** row. It opens the popup whatever the
stored state says. Plan 1 of the mobile redesign adds this row; until then the popup is auto-only.

## UI (B + split button)

- Dialog centred over a scrim: `--beheer-window` background, 28px radius, width `calc(100vw − 32px)` with max 360px.
  It enters with a spring scale 0.9 → 1 and fades in.
- **Hero**, 170px high: tertiaryContainer background with a radial orange glow. On it, a tilted phone illustration
  (map, vossen widget, floating toolbar, markers) and a small "VOSSEN" widget card. Top right is an X on a
  `rgb(0 0 0/.25)` circle, which means "Later".
- **Body**, padding 18px 20px 16px:
  - Title "De Jotihunt-app voor Android" (20/700).
  - Subtitle "Je telefoon als tracker, ook als het scherm uit is." (13.5 muted).
  - Four tonal chips (32px, fully round): Achtergrond-tracker (secondaryContainer), Meldingen (warnContainer),
    Widgets (tertiaryContainer), Android Auto (primaryContainer).
- **Split button** (M3 Expressive):
  - Primary part: "Download · {versionName}", with radius 12/4.
  - ▾ part: 48px wide, radius 4/12. While its menu is open it morphs to a full circle and the arrow turns 180°.
  - The menu opens upwards from the right with a scale/fade: "Later herinneren" (clock icon) and
    "Niet meer tonen" (eye-off icon).
  - `AppRelease` has no file size, so the button shows the version, not MB.

## Flow (same dialog, each step swaps in with SWAP; a 3-segment stepper on top for steps 1–3)

1. **Download.** An `<a href={absoluteUrl(API_BASE_URL, release.url, origin)} download>` click starts the browser
   download. "Downloaden…" shows for 1.2 s, then step 2. The browser owns the download, so there is no real progress.
2. **Installeren.**
   - Text: "Tik op de download-melding en dan op **Installeren**."
   - Amber tip box: "Vraagt Android om toestemming? Kies **Instellingen → Toestaan van deze bron** voor Chrome, en ga
     terug."
   - Buttons: primary "Geïnstalleerd, koppel nu" and text "Opnieuw downloaden".
3. **Koppelen.**
   - `usePairingCode().create()` makes a code, then
     `window.location.href = buildPairingUrl(API_BASE_URL, code, origin)`.
   - While waiting, a spinner with "App openen…".
   - The tracker status is polled through `useTrackerStatus` (it already polls every 10 s while not connected).
     When `connected` becomes true → step 4.
   - If the page is still visible 2.5 s after the deep link, the app didn't open. Show "App ging niet open?
     Installeer hem eerst." with "Terug" (back to step 2) and "Opnieuw proberen".
   - If the user comes back to the tab without a connection, show "Wachten op de app…" with "Opnieuw proberen".
4. **Gekoppeld.** The 72px green cookie check pops in, then "Gekoppeld!" and "Je tracker staat nu in de app · live",
   and a primary "Klaar". Store `never: true`.

Back button: `useBackEntry('android-promo', open, later)`, from mobile shell plan 1. Back acts as "Later".

## Units

- `src/lib/android-promo.ts` (pure, tested):
  - `isAndroidUserAgent(ua)`
  - `readPromoState(storage)` and `writePromoState(storage, state)`
  - `laterState(now)`
  - `shouldShowAndroidPromo({ isMobile, isAndroid, hasRelease, paired, installed, state, now })`
  - `appDidNotOpen(startedAt, now, visible)`: `visible && now − startedAt ≥ 2500`
- `src/stores/android-promo.store.ts`: `{ open, step, setOpen, setStep, openManually }`.
- `src/hooks/android-promo.hook.ts`: `useAndroidPromoAutoOpen()` gathers the conditions and opens the popup once per
  session.
- `src/components/android-promo/`:
  - `AndroidPromoDialog.tsx` (shell, scrim, steps)
  - `AndroidPromoHero.tsx`
  - `DownloadSplitButton.tsx`
  - `PromoSteps.tsx` (steps 1–4)
- Mounted in `Layout.tsx` next to the other dialogs.
- Web manifest (`vite.config.ts`):
  `related_applications: [{ platform: 'play', id: 'nl.jotihunt.tracker' }]` and `prefer_related_applications: false`.
  The APK needs an `asset_statements` entry for `getInstalledRelatedApps` to report it. That is an Android-app
  follow-up and not required.

## Tests

`bun test` on `android-promo.ts`:
- UA detection.
- Each condition in `shouldShowAndroidPromo` on its own.
- 3-day later window: still hidden just before it ends, shown just after.
- `never` wins over everything.
- Corrupt storage JSON counts as empty.
- `appDidNotOpen` timing and the visible/hidden cases.
