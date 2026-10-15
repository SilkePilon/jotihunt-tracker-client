# QR sign-in confirm drawer redesign (C1) — design

Date: 2026-10-15. Mockups (visual companion, project root `.superpowers/brainstorm/20716-1792094651/content/`):
`qr-confirm.html` (picked direction **C**) and `qr-confirm-c.html` (picked **C1**).

## Goal

Restyle `src/components/auth/QrConfirmDrawer.tsx`, the drawer a phone shows after scanning a laptop's login QR code.
It should look like the rest of the app, and a deliberate **hold-to-confirm** should replace the warning text. Logic,
API calls and states stay the same: loading, ready, done and problem.

## Ready step (C1)

From top to bottom:

1. **Illustration**, about 64 × 52, centred, padding 6px top and 14px bottom.
   - A laptop with a small QR glyph on its screen, then an animated dashed line in primary, then a phone outlined in
     primary with a primary dot.
   - The dashes march from left to right: stroke-dashoffset loops over 1s. With `prefers-reduced-motion` the line is
     static.
   - Inline SVG in a small `QrLinkIllustration` component.
2. **Title**: "Inloggen op {requester.label}?", 19px/700, line-height 1.25.
3. **Meta line**: `{location} · {formatLastUpdate(createdAt, now)} · als **{user.name}**`, 13.5px muted, with the name
   in foreground bold. Missing parts are dropped (`joinParts`).
4. **Error line** (passkey cancelled or mismatch): kept as today, `role="alert"`, revealed with `Reveal`.
5. **Buttons**, stacked with an 8px gap and 18px above:
   - **Primary hold button** (48px, rounded-xl):
     - Content: key icon plus "Houd vast om te bevestigen".
     - Pressing and holding fills it left to right with a `rgb(255 255 255/.22)` overlay over **1000 ms**, linear.
     - Releasing early reverses the fill over 0.25s and does nothing.
     - A complete hold calls the existing `confirm(scan)`, which shows the passkey prompt.
     - While busy: spinner plus "Wachten op passkey…", disabled.
     - Keyboard: holding Space or Enter fills it the same way, and `keyup` cancels.
     - Touch/pen: a full fill arms the button with the label "Laat los om te bevestigen" and confirms on finger lift
       (WebAuthn needs the pointerup user gesture); mouse and keyboard confirm at full.
     - `aria-label="Houd vast om te bevestigen"`.
     - A short tap does nothing, but the label stays visible, so it is still obvious what to do.
   - **Secondary** `bg-beheer-row-high` "Nee, dat ben ik niet" runs the existing `refuse()`.

**Removed:** the amber "Alleen bevestigen als jij net zelf deze code scande." line, the bordered device box, and the
heading "Inloggen op een ander apparaat?" with "Iemand wil inloggen als".

## Other steps

- **Loading**: skeletons in the new layout: the illustration (static) plus two text bars.
- **Done**: unchanged. SuccessBadge 72, "Bevestigd", "{label} kan nu inloggen als {name}.", "Naar de kaart", auto-close
  after 1.8s.
- **Problem**: unchanged logic. Restyled to match: an errorContainer cookie icon (48, X glyph) next to "Dat lukte niet"
  and the message, then "Passkey toevoegen" (primary, when relevant) and "Sluiten" (secondary).

Every step swap keeps `AnimatePresence mode="wait"` with SWAP inside `AutoHeight`, as today.

## Units

- `src/components/auth/QrLinkIllustration.tsx`: the SVG, with a `animated?: boolean` prop.
- `src/components/auth/HoldButton.tsx`: a reusable hold-to-confirm button.
  - Props: `{ durationMs?: number; onConfirm: () => void; disabled?: boolean; busy?: boolean; busyLabel; children }`.
  - Implementation: motion value plus `animate()`; pointer and keyboard handlers; cancel on pointerup, pointerleave
    and pointercancel; no confirm when disabled.
- Pure helper with tests in `src/lib/hold.ts`: `holdProgressAfter(elapsedMs, durationMs)` clamps to 0..1, and
  `isHoldComplete`.
- `QrConfirmDrawer.tsx`: new ready, loading and problem markup.

## Tests

`bun test` on `src/lib/hold.ts`: clamping, completion at exactly `durationMs`, and zero or negative input.
