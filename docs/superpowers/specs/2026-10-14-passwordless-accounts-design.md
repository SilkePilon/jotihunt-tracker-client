# Passwordless accounts: passkeys, invites, QR login, Beheer

Date: 2026-10-14
Repos: `jotihunt-tracker-server`, `jotihunt-tracker-client` (Android app unchanged)
Mockups: `/home/silke/Documents/Jotihunt 2026/.superpowers/brainstorm/129170-1791927526/content/` (`login-layout-v2.html` option B, `invite-page.html` option C, `qr-confirm.html` option C, `beheer-v3.html`)

## Goal

Email + password login is too slow and fiddly on phones. Replace it with:

- **Passkeys only.** No passwords anywhere. Login is one tap (fingerprint / face / screen lock).
- **Invite links** (Discord-style). An admin makes a link with an expiry and a max number of uses, can revoke it, and anyone with the link creates their own account with just a name + passkey.
- **QR login** for laptops and the HQ beamer: the laptop shows a QR, a phone that is already logged in scans it and confirms with its passkey.
- **30-day sliding sessions**, revocable per device.
- **Herstel-links**: an admin makes a one-time link for a user who lost their passkey (or for existing accounts after the switch).
- **Beheer**: one admin window replacing the "Admin tools" submenu and its separate dialogs.

Non-goals: email sending, password fallback, approval queues, roles beyond `admin`, changes to Android pairing.

## Decisions

| Topic | Decision |
|---|---|
| Signup fields | Display name + passkey. No email, no username. |
| After invite signup | Account active immediately. Invites always create normal users; admin rights are given afterwards in Beheer. |
| Passwords | Removed completely. Existing users get a herstel-link from an admin. No one is logged in right now, so the hard switch is safe. |
| Device without passkey support | Account/session still works (30-day session). A banner asks to add a passkey later. Getting back in: QR login from a phone, or a herstel-link. |
| QR confirm on phone | Drawer over the map, confirm **with a passkey assertion** (a grabbed, unlocked phone cannot approve a login). |
| Group branding on invite page | Home team (`HOME_TEAM_API_ID`) `Team.name` + `Team.logoUrl`; fallback `GROUP_NAME` / `LOGO_URL` / `/logo.svg`. |
| Pause all invites | Global switch "Invites pauzeren" in Beheer → Algemeen. |

## Server

### Dependencies

- Add `@simplewebauthn/server` (server) and `@simplewebauthn/browser` (client).
- Config (env): `WEBAUTHN_RP_ID` (e.g. `jotihunt.silkepilon.dev`, `localhost` in dev), `WEBAUTHN_RP_NAME` (default `Jotihunt Tracker`), `WEBAUTHN_ORIGINS` (comma-separated allowed origins), `PUBLIC_APP_URL` (base for invite/herstel/QR links). Startup fails with a clear message when `WEBAUTHN_RP_ID` or `WEBAUTHN_ORIGINS` is missing.

### Models

**User** (changed)
- Remove: `email`, `password`, `requiresPasswordChange`, `passwordChangedAt`, `hashPassword`.
- Keep: `name`, `admin`, `tutorialVersion`, `notificationPrefs`, `readArticles`, `tracker`, `devices[]` (Android).
- Add:
  - `webauthnUserId: string` (random 32-byte base64url, the WebAuthn `user.id`, never the Mongo id)
  - `passkeys: [{ credentialId (base64url, unique index), publicKey (Buffer), counter, transports[], name, createdAt, lastUsedAt }]`
  - `invite: ObjectId | null` (which invite created the account)
  - `lastActiveAt: Date`
- Migration (one-off script, idempotent): unset the removed fields on all users, generate `webauthnUserId` where missing. Existing accounts keep their name/admin/tracker/devices.

**Session** (new)
- `user`, `label` (parsed from User-Agent, e.g. "Firefox op Linux"), `createdAt`, `lastUsedAt`, `expiresAt`, `via: 'passkey' | 'invite' | 'herstel' | 'qr' | 'cli'`.
- The web token is a JWT `{ sid, kind: "web" }` signed with `JWT_SECRET`, `exp` 365 days (react-auth-kit v3 only accepts JWTs with `exp`). The real lifetime is the session document: a token whose session is gone or expired is a 401. Revoking = deleting the session.
- TTL index on `expiresAt`.
- Sliding: on an authenticated request, when `lastUsedAt` is more than 1 hour old, set `lastUsedAt = now`, `expiresAt = now + 30 days`.

**Invite** (new)
- `code` (8 chars, Crockford base32 without ambiguous chars, unique), `createdBy`, `createdAt`, `expiresAt: Date | null`, `maxUses: number | null`, `uses`, `revokedAt: Date | null`.
- Valid when: not revoked, not expired, `maxUses === null || uses < maxUses`, and invites are not paused.
- Use is claimed atomically: `findOneAndUpdate({ code, revokedAt: null, $or: [expiry ok], $expr: uses < maxUses or maxUses null }, { $inc: { uses: 1 } })` at account creation, so a full invite cannot be over-used.
- Expiry options (UI): 30 min, 1 uur, 6 uur, 12 uur, 1 dag (default), 7 dagen, nooit. Max uses: 1, 5, 10, 25, 50, 100, onbeperkt (default).

**RecoveryLink** (new)
- `tokenHash`, `user`, `createdBy`, `expiresAt` (1 hour), `usedAt`. Single use (atomic `usedAt: null → now`).

**QrLogin** (new)
- `codeHash` (code is the URL secret shown in the QR), `pollSecretHash` (only the laptop knows it), `status: 'waiting' | 'scanned' | 'approved' | 'denied'`, `requester: { label, ip }`, `scannedBy: user | null`, `challenge` (for the phone's passkey assertion), `expiresAt` (2 minutes; extended to 2 minutes after scan), `session token` handed over once on approval.

**Invite setting**: document `{ key: "invites", paused }` in the `settings` collection.

**Where auth data lives (demo mode).** Sessions, invites, herstel-links, WebAuthn challenges and the invite setting live in the **real** database (the demo state store connection), so switching demo mode never logs anyone out or loses invites. User creation and passkey changes are written to the current (default) database and, while demo mode is on, mirrored to the real database, so accounts made during a demo survive it.

**Group info** for the invite page: server env `HOME_TEAM_API_ID` (Team `apiId`) and `GROUP_NAME` (fallback name).

### Auth middleware

- `verifyToken` reads `Authorization: Bearer <token>` (always a JWT).
  - Web: `sid` claim → `Session` lookup → user. Missing/expired session → 401. JWTs with neither `sid` nor `did` (old password-era tokens) → 401.
  - Android: keeps the existing device JWT (`kind: "device"`, `did`) path untouched.
- Remove the password-change gate (`PASSWORD_CHANGE_REQUIRED`) and `verifyTokenAllowingPasswordChange`.
- `lastActiveAt` updated together with the sliding refresh (max once per hour).

### Endpoints

Public (rate limited per IP; failures additionally per code/token):

| Method & path | Purpose |
|---|---|
| `POST /auth/passkey/login/options` | Authentication options (discoverable, `userVerification: 'required'`); challenge stored server-side keyed by a short-lived id returned to the client. |
| `POST /auth/passkey/login/verify` | Verify assertion → find user by credentialId → update counter/lastUsedAt → create session → `{ token, user }`. |
| `GET /invites/:code` | Public invite info: `{ valid, reason?, group: { name, logoUrl }, invitedBy: name, memberCount, onlineCount }`. `reason`: `expired`, `revoked`, `full`, `paused`, `unknown`. |
| `POST /invites/:code/register/options` | Body `{ name }` (1–40 chars, trimmed). Returns registration options for a not-yet-created user (pending registration keyed by id, 5 min). |
| `POST /invites/:code/register/verify` | Verify attestation, claim invite use atomically, create user + passkey + session. If the invite became invalid in between → 410 with `reason`. |
| `POST /invites/:code/register/no-passkey` | Fallback when the browser has no WebAuthn: claim invite, create user without passkey + session. |
| `GET /herstel/:token` | Validity + user name. |
| `POST /herstel/:token/register/options` and `/verify` | Add a new passkey to that user, mark link used, create session. `/no-passkey` variant like invites. |
| `POST /auth/qr` | Laptop: create QR login → `{ id, code, pollSecret, expiresAt }`. |
| `GET /auth/qr/:id?secret=` | Laptop polls (every 1.5 s): `{ status, scannedBy?: { name } }`; on `approved` returns `{ token, user }` exactly once. |

Authenticated:

| Method & path | Purpose |
|---|---|
| `GET /auth/qr/scan/:code` | Phone: mark `scanned`, return requester label/approx location + passkey assertion options bound to this QR login (`allowCredentials` = this user's passkeys). |
| `POST /auth/qr/scan/:code/approve` | Verify the assertion (must belong to the scanning user) → `approved`, create a session for the laptop (`via: 'qr'`). |
| `POST /auth/qr/scan/:code/deny` | `denied`. |
| `GET /auth/me`, `POST /auth/logout` | Current user; revoke current session. |
| `GET /account/passkeys`, `PATCH /account/passkeys/:id` (rename), `DELETE /account/passkeys/:id` (refused for the last one) | Account dialog. |
| `POST /account/passkeys/options` + `/verify` | Add a passkey to an existing account (also used by the "add a passkey" banner). |
| `GET /account/sessions`, `DELETE /account/sessions/:id`, `DELETE /account/sessions` (all others) | Active web sessions; Android devices keep using `/auth/devices`. |

Admin (`isAdmin`):

| Method & path | Purpose |
|---|---|
| `GET/POST /admin/invites`, `DELETE /admin/invites/:id` (revoke) | Invite management. Expired/full/revoked invites are hidden from the list after 24 h. |
| `POST /admin/users/:id/recovery-link` | Create herstel-link → `{ url, expiresAt }`. |
| `PUT /admin/users/:id` | Name and admin flag only (last-admin protection stays). |
| `DELETE /admin/users/:id` | Unchanged (also deletes their sessions). |
| `PUT /settings/invites-paused` | Global pause switch. |

Removed: `POST /auth/login`, `POST /auth/update-password`, `POST /admin/users` (creation goes through invites), password field on `PUT /admin/users/:id`, `requiresPasswordChange` handling, `src/scripts/create-user.ts`.

### CLI bootstrap

`bun run login-link --user <name>` prints a herstel-link for an existing user. `bun run login-link --new <name> [--admin]` creates a user (no passkey) and prints a herstel-link. This is how the first admin gets in after deploy.

### Security notes

- `userVerification: 'required'` on every ceremony. Counter regression → reject and log.
- Herstel tokens, QR codes and QR poll secrets are stored only as SHA-256 hashes. Session tokens are signed JWTs pointing at a session document. Invite codes are not secret-grade (they are shared), so they are stored plainly but rate-limited.
- QR approve requires an assertion from the **scanning** user and binds to that QR login's challenge, so a phished QR cannot be approved without a fresh biometric. The confirm drawer shows device label + approximate location + "Alleen bevestigen als jij net zelf deze code scande."
- Deleting a user or removing their last passkey does not leave dangling sessions: delete user → delete sessions; "log out everywhere" in Account deletes all other sessions.

## Client

### Routes

| Route | Screen |
|---|---|
| `/login` | **Login B**: full-screen dimmed `background.webp`, one wide card. Left: logo, "Welkom terug!", explanation, `Inloggen met passkey` (lg), "Geen account? Vraag de organisatie om een invite-link." Right (desktop only): 176 px QR (`lib/qr-code`), "Inloggen met QR-code", countdown "Nieuwe code over 1:42". States: waiting → scanned (initial avatar + "Bevestig op je telefoon", "Niet jij? Opnieuw") → logged in (`CookieBadge tone="ok"` + "Ingelogd") → expired after 10 min ("Nieuwe code" button). Phone: card at the bottom with only the passkey button. Keeps the "Ontwikkeling door Silke Pilon" footer. |
| `/invite/:code` | **Invite C**: same background; wide card split in two. Left: group logo (rounded, `ring-1 ring-border`), "{admin} nodigt je uit voor", group name, "23 leden · 5 online". Right: "Maak je account", "Hoe heet je?" input, `Account maken met passkey`. Phone: compact header row + form. Invalid: "Deze uitnodiging werkt niet meer" + reason text + "Naar inloggen". Success: `CookieBadge tone="ok"` 72 px, "Welkom, {name}!", "Naar de kaart". No WebAuthn: button reads `Account maken`, then the add-passkey banner later. |
| `/herstel/:token` | Same card as invite C: "Nieuwe passkey voor {name}" + `Passkey maken`. |
| `/l/:code` | Phone opens the map with the **QR confirm drawer (C)**: "Inloggen op een ander apparaat?", "Iemand wil inloggen als **{name}**.", box with device label + location · time, amber warning line, `Bevestigen met passkey` (primary) + `Nee, dat ben ik niet` (outline). Not logged in on the phone → go to `/login`, then back. |

Passkey errors (Dutch, three-part pattern): cancelled/timeout (`NotAllowedError`) → "Inloggen niet afgerond. Probeer het opnieuw."; unsupported → "Deze browser ondersteunt geen passkeys. Log in met de QR-code vanaf je telefoon."; unknown credential → "Deze passkey werkt niet meer. Vraag de organisatie om een herstel-link." Never show raw error names.

### Auth plumbing

- `react-auth-kit` keeps storing the token (now a session JWT with a 365-day `exp`) in its cookie; the server's 30-day sliding session decides the real lifetime. On a 401 the client signs out and routes to `/login`.
- Remove `PasswordChangeGate`, `PasswordChangeForm`, `ResetPassword`, `lib/password-change.ts` and the password parts of `auth.hook.ts`.
- Banner (sidebar, dismissible per session) when the user has 0 passkeys and the browser supports them: "Voeg een passkey toe om sneller in te loggen" → add passkey.

### Gear menu

- "Wachtwoord wijzigen" → **Account** (opens the Account dialog).
- "Admin tools" submenu → **Beheer** (opens the Beheer dialog). `AdminSubmenu`, `UsersDialog`, `HuntersDialog`, `BroadcastDialog`, `DemoModeDialog` trigger, `ReloadTeamsDialog` trigger move into Beheer.

### Beheer dialog (mockup `beheer-v3.html`)

`ResponsiveDialog`; desktop = side menu (210 px, `bg-muted/30`, items with lucide icon, active `bg-accent`) + content. Phone = drawer with a list of sections, tap to enter, back arrow.

Every page uses the same structure: `h2` title + muted one-liner, then groups of a small `text-sm font-semibold` heading over a `rounded-lg border divide-y` box with rows (`px-4 py-3`, title `text-sm font-medium` + `text-xs text-muted-foreground` meta, one trailing control).

- **Algemeen**: Functies — AI-voorspelling (switch), Demo mode (switch, existing confirm dialog), Invites pauzeren (switch). Gegevens — Teams herladen uit API (outline destructive button, existing confirm).
- **Gebruikers**: groups Admins / Leden; meta "N passkeys · laatst actief"; ⋯ menu: Herstel-link maken (shows link + copy + QR), Naam wijzigen, Admin maken/weghalen, Verwijderen (confirm).
- **Invites**: header button `Nieuwe invite`; group Actief, rows code (mono) + "7 van 25 gebruikt · nog 6 uur · Silke" + `Kopieer` + ⋯ (QR-code tonen, Intrekken). Nieuwe invite reveals a group with "Verloopt na" and "Aantal keer" selects, then the new link is shown with copy + QR.
- **Hunters**: groups Live / Niet live; meta "Lopend · zojuist · 82% · 5 km/u"; ⋯ menu: voertuig wijzigen, op kaart, Google Maps (from `HuntersPanel`).
- **Bericht versturen**: group Nieuw bericht (textarea + counter + Versturen), group Eerder verstuurd.
- **Koppelingen**: Telegram and Life360 rows (status meta + Koppelen/Ontkoppelen). Koppelen opens the existing link panels inside this page. The sidebar cards keep the read-only views.
- **HQ-scherm**: link at the bottom of the side menu (opens `/hq` in a new tab).

Visual polish of Beheer is deliberately minimal for now and will be refined later.

### Account dialog

Same Beheer row style, no side menu.
- **Passkeys**: rows name + "Gemaakt 3 okt · laatst gebruikt zojuist"; ⋯ Hernoemen / Verwijderen (disabled on the last one). Button `Passkey toevoegen`.
- **Actieve apparaten**: "Dit apparaat" first; web sessions (label · last used) and Android devices; `Uitloggen` per row; footer button `Alle andere apparaten uitloggen`.

## Build order (separate implementation plans)

1. **Server core + login/invite/herstel pages**: models, migration, middleware, passkey login, invites, herstel-links, CLI, Account endpoints needed by the banner; client `/login` (passkey part), `/invite/:code`, `/herstel/:token`, remove password UI.
2. **QR login**: server QR endpoints, login page QR half, `/l/:code` drawer.
3. **Beheer dialog**: move admin dialogs + Telegram/Life360 linking, invites UI, herstel-link UI, invites-paused switch.
4. **Account dialog**: passkeys + active devices.

## Testing

- Server (bun test, `jotihunt-test` DB): invite validity matrix (expired/revoked/full/paused), atomic use under concurrent claims, session sliding + expiry + revoke, herstel single use, QR state machine (wrong user, expired, double poll after approve, deny), last-passkey protection, last-admin protection, migration idempotency. WebAuthn ceremonies tested with `@simplewebauthn/server` verification mocked at the module boundary.
- Client (vitest): passkey error mapping, QR countdown/state reducer, invite reason → copy.
- Manual: real passkey on Android Chrome + desktop Chrome/Firefox against a local instance with `WEBAUTHN_RP_ID=localhost`; QR flow laptop ↔ phone on the deployed domain.

## Rollout

No one is logged in, so the hard switch is fine: deploy server + client together, run the migration, run `login-link --user Silke` to get back in, then hand out invites / herstel-links. Set `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGINS` and `PUBLIC_APP_URL` in the homelab manifests.
