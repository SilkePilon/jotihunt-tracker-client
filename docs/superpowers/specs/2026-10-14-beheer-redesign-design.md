# Beheer redesign — design

Date: 2026-10-14. Picked page by page in the visual companion (mockups in
`.superpowers/brainstorm/752618-1791974615/content/`: `beheer-nav.html` N1, `p1-gebruikers-v2.html` G3,
`p2-invites.html` I5, `p3-hunters.html` H1, `p4-bericht.html` B4, `p5-koppelingen.html` K1).

## Goal

The admin "Beheer" window (`src/components/beheer/`) feels like a plain form. Restyle every pane in the app's language
(tonal cards, pills, M3 switches, orange accent, motion) without changing what the panes can do. Frontend only; the
server API stays as is.

## Global rules

- **No avatar / profile circles. No icons in card titles.**
- Every state change animates (`motion/react`, `lib/motion` SWAP/POP/REVEAL; rows that come and go fold in/out;
  `prefers-reduced-motion` respected via the global `MotionConfig`).
- Dutch copy as today unless stated.

## Shell (N1)

- Desktop: left nav 220px, items = icon + name, 40px high, `rounded-xl`; active item = soft grey fill
  (`bg-secondary`/`--muted` level) + semibold, inactive muted text. No pill shape, no orange. "HQ-scherm" (external) at
  the bottom. Title "Beheer" above the items.
- Phone: keep today's flow (section list → pane with back arrow), restyled with the same item look and the new cards.
- Pane header: title 22px bold + one muted line; optional action on the right.

## Building blocks (D1)

Replace `BeheerLayout.tsx` primitives (keep names where sensible):
- `BeheerPane` — header + vertical stack (gap 14px).
- `BeheerCard` — `bg-card rounded-3xl p-4`; header row: title (15px bold) + optional `· count` (muted) + optional muted
  line under the title + optional right slot. No icon.
- `BeheerRows` + `BeheerRow` — rows are separate tonal blocks (`bg-muted`-like soft surface), 2px gap; first row top
  radius 16, last row bottom radius 16, inner radius 6 (M3 segmented list). Row = optional leading element, title,
  muted meta, trailing slot. Rows enter/exit with height+opacity (as today).
- `BeheerExpandableRow` — a row that toggles open on tap (chevron rotates); the open part unfolds under the row content
  (indented to the text column) and holds action pills. One open row per card.
- Inline confirm: a row (or card section) can morph into a red-tinted confirm block: bold question, muted consequence
  line, "Annuleer" (secondary pill) + destructive pill.
- Buttons: pills (`rounded-full`); primary = orange; secondary = soft fill; destructive-outline = red ring + red text;
  destructive = solid red (only inside confirms).
- Switch: M3 look (track 44×26, thumb grows when on, orange track when on).
- Segmented picker: pill group on soft background, selected segment = card colour + shadow.

## Panes

### Algemeen
1. Card **"Andere vossen die we mogen hunten"** — see `2026-10-14-huntable-areas-design.md` (chips with check/lock,
   count `n/9`, own area excluded).
2. Card **Functies** — rows (leading muted icon) AI-voorspelling, Demo mode, Invites pauzeren, each with the M3 switch.
   Behaviour as today (demo opens its confirm dialog).
3. Card **Gegevens** — row "Teams herladen uit API" with a red-tinted "Herladen" pill (opens the existing dialog).

### Gebruikers (G3)
- Header line: "n accounts · m nu actief".
- Cards **Admins · n** and **Leden · n**. Row: small activity dot (green = now active, grey otherwise), name, "Admin" pill
  (orange tint) and "jij" pill, meta "x passkeys · <activity>" (amber "geen passkey" when 0).
- Tap → expands: pills **Herstel-link** (spinner → "Link gekopieerd ✓"), **Naam wijzigen** (inline input in the row,
  Enter/Esc), **Admin maken / Geen admin meer**, **Verwijderen** (destructive-outline). Own row: no admin/delete.
- Verwijderen → the row morphs into the inline confirm ("<naam> verwijderen?" · "Account en alle sessies worden
  verwijderd.").
- A role change moves the row to the other card (layout animation).

### Invites (I5)
- Card **Nieuwe invite** (muted line "Iedereen met de link kan een account maken."): segmented **Geldig**
  (existing EXPIRY_OPTIONS, shown as segments) and **Aantal keer** (existing MAX_USES_OPTIONS), primary pill
  **Invite maken**. A new invite appears at the top of Actief with a short orange ring pulse.
- Card **Actief · n**: rows with mono code + meta (`inviteMeta`), trailing: **WhatsApp** pill (opens
  `https://wa.me/?text=<encoded message with link>`), copy icon button (morphs to ✓ for 1.5 s, toast as today), QR icon
  button (QR unfolds under the row; reuse the existing invite QR rendering), stop icon button (keeps today's confirm).
  **No Telegram button.**
- Card **Gestopt · n**: collapsed by default, header toggles; rows muted with struck-through code + state pill.

### Hunters (H1)
- Header line: "n live · m niet live". Cards **Live · n** and **Niet live · n**.
- Row: leading = the map hunter marker look (vehicle glyph in the secondaryContainer circle; grey + 60 % when not live),
  name, meta (`hunterMeta`), battery glyph + % on the right (red under 20 %), chevron.
- Tap → expands: **Toon op kaart**, **Google Maps** pills (today's actions) + vehicle segmented picker
  (Lopend / Fiets / Auto / Motor) if vehicle changing exists today; otherwise only the two pills.

### Bericht versturen (B4)
- Card **Nieuw bericht** (muted line "Iedereen krijgt dit als melding met geluid."): textarea (soft surface, rounded-2xl,
  max 200), counter `n / 200`, primary pill **"Naar N mensen sturen"** (N = number of users, from the users list the
  client already loads for Beheer; fallback "Naar iedereen sturen").
- First tap → the pill turns amber **"Zeker? Tik nogmaals"** for 3 s (then reverts); second tap sends: spinner
  "Versturen…" → "Verstuurd ✓" (1.6 s) and the textarea clears.
- Card **Eerder verstuurd · n**: rows (body + `broadcastMeta`), trailing secondary pill **Opnieuw** that refills the
  textarea. The new message animates in at the top.

### Koppelingen (K1)
- One card per integration (Telegram, Life360): the **real logos** (`TelegramLogo`, `Life360Logo`) in a tonal circle,
  name + status pill (**Verbonden** green / **Niet gekoppeld** grey / **Aandacht nodig** amber), line "gekoppeld als …"
  (from today's `telegramMeta` / `life360Meta` info), last-sync line with a refresh icon button that spins while
  refreshing (Life360 "ververs"; Telegram has no manual refresh → no button).
- **Ontkoppelen**: destructive-outline pill → inline confirm in the card with the consequence (today's dialog texts).
- Error state: amber bar inside the card with the problem + **Opnieuw koppelen**.
- Not linked: muted description + primary **Koppelen** → the existing `TelegramLinkPanel` / `Life360LinkPanel` steps
  unfold inside the card (restyled to the new pills/inputs where they live in Beheer only).

## Out of scope

Server changes, new Beheer features (activity logs, delivery stats, sound choice, templates), the sidebar cards.

## Testing

`tsc -b`, lint, existing unit tests (`lib/beheer.ts`, `lib/hunters.ts`); new pure helpers get tests. Browser check on vite
:5174 against prod (admin login): every pane desktop + phone width, light + dark, expand/confirm/copy/QR/send flows,
animations.
