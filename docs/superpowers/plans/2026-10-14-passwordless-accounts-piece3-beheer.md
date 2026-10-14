# Passwordless accounts, piece 3: Beheer window — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One admin window "Beheer" (gear menu) replaces the "Admin tools" submenu and its separate dialogs, and adds the missing admin UI for invites, invite pausing and broadcast history.

**Architecture:** `ResponsiveDialog` with a side menu (desktop) or a section list with a back arrow (phone). Each section is a pane component built from two shared layout pieces (`BeheerGroup`, `BeheerRow`) in the approved Beheer v3 style. Panes reuse the existing hooks (`useAdmin`, `useDevices`, `useDemo`, `usePredictionSetting`, `useTelegramAdmin`, `useLife360Admin`, `useTeams`) and existing dialogs (`RecoveryLinkDialog`, `DemoModeDialog`, `ReloadTeamsDialog`, `ConfirmDialog`). New: client hooks for invites / invites-paused / broadcasts, pure formatting helpers (tested), and one server endpoint `GET /admin/broadcasts`.

**Tech Stack:** Server Bun + Express 5 + Mongoose 9; client React 19 + SWR + zustand + shadcn + vaul + motion v14.

Spec: `docs/superpowers/specs/2026-10-14-passwordless-accounts-design.md` (Gear menu, Beheer dialog). Approved mockup: `/home/silke/Documents/Jotihunt 2026/.superpowers/brainstorm/129170-1791927526/content/beheer-v3.html` — open it; it is the visual reference for every pane.

## Global Constraints

- Worktrees: server `/home/silke/Documents/Jotihunt 2026/.worktrees/server-beheer`, client `/home/silke/Documents/Jotihunt 2026/.worktrees/client-beheer`, both on branch `feat/beheer`. Never touch the main checkouts (the client main checkout is used by another session), the live docker stack, the k3s cluster or their databases.
- Run bun as `npx --yes bun ...`. Server: `npx --yes bun run test`, `npx --yes bun run typecheck`, `npx --yes bun run lint`; tests use Mongo db `jotihunt-test` only. Client: `npx --yes bun test`, `npx --yes bun x tsc -b` (needs `node_modules/vite-envs/client.d.ts`: run `npx --yes bun x vite build --outDir /tmp/jh-beheer-build` once if missing, delete the dir after), `npx --yes bun run lint`. `npx --yes bun install` first in a fresh worktree.
- **Plain style (user rejected fancier versions twice):** every pane = `h2` `text-lg font-semibold` + one muted `text-sm` line, then groups: heading `text-sm font-semibold mb-2`, box `rounded-lg border divide-y`, rows `flex items-center gap-4 px-4 py-3` with title `text-sm font-medium` + meta `text-xs text-muted-foreground` and one trailing control (switch, `h-8 px-3` button, or a ghost `size-8` ⋯ icon button with a `DropdownMenu`). No avatars, no coloured status cards, no cards inside cards.
- Desktop frame: side menu `w-[210px] border-r bg-muted/30 p-3`, heading "Beheer" (`px-2 pb-2 pt-1 text-sm font-semibold`), items `flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground`, active `bg-accent text-foreground font-medium`, optional count `ml-auto text-xs`; "HQ-scherm" pinned at the bottom (`mt-auto`) with an external-link icon. Content pane `p-8 flex flex-col gap-7`, scrolls on its own.
- Phone (`useIsMobile()`): the drawer first shows the section list (same items, larger touch rows); tapping one shows that pane with a back arrow header; HQ-scherm opens the new tab.
- **Animations (user requirement — nothing may appear or disappear without animation):** pane switches use `AnimatePresence mode="wait"` + `SWAP` (`src/lib/motion.ts`); phone list ↔ pane slides horizontally (x ±24 px + fade, 0.22 s, `EASE_OUT`); rows enter/exit with fade + height (`REVEAL_TRANSITION`, padding on an inner div so the height animation doesn't jump); inline blocks/errors use `Reveal` (`src/components/motion/Reveal.tsx`); a newly created invite's row highlights briefly (bg `accent` fading out over 1.2 s). `MotionConfig reducedMotion="user"` is already global.
- All copy Dutch, exactly as in this plan.
- Code style: match the files you touch (client feature files single quotes 2-space; `Settings.tsx`/`Layout.tsx` 4-space, no spaces inside JSX braces; server double quotes 2-space).
- Commit after each task; messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Decisions (made in planning; deviations from the spec are marked)

- **Store:** `useAdminStore` (`src/stores/admin.store.ts`) keeps its shape `{ dialog, openDialog(id), close() }` but `dialog` becomes the open Beheer section: `type AdminDialogId = 'algemeen' | 'users' | 'invites' | 'hunters' | 'broadcast' | 'koppelingen'`. The onboarding tour (`useTour.ts` reads `dialog !== null`) and `src/pages/Users.tsx` (`openDialog('users')`) keep working unchanged.
- **Gear menu:** the "Admin tools" submenu becomes one item **"Beheer"** (`ShieldIcon`) → `openDialog('algemeen')`. "Debug" stays in the gear menu as today (not in the mockup).
- **Removed after the move:** `AdminSubmenu.tsx`, `UsersDialog.tsx`, `HuntersDialog.tsx`, `BroadcastDialog.tsx` and their mounts; `UsersPanel.tsx` and `HuntersPanel.tsx` are replaced by the new panes (delete them once nothing imports them; keep `RecoveryLinkDialog`). `DemoModeDialog` and `ReloadTeamsDialog` stay and are opened from Algemeen.
- **Koppelingen (deviation):** the pane shows Telegram and Life360 status rows; "Koppelen" expands the existing link panel (`TelegramLinkPanel` / `Life360LinkPanel`) inside the pane, "Ontkoppelen" asks the existing confirm copy. The sidebar cards stay exactly as they are for now (removing their admin parts is a later clean-up).
- **Broadcast length:** 200 characters (server limit), not the mockup's 120. **Broadcast history:** new `GET /admin/broadcasts` (notifications live 48 h).
- **Invites:** codes are 8 characters (mockup shows 6). Stopped invites (expired/revoked/full, the server returns them for 24 h) show in a second group "Gestopt".
- **Users:** no search box and no paging (≈25 users); "Naam wijzigen" is a small rename dialog sending `PUT /admin/users/:id { name }`; "Admin maken" / "Admin afnemen" send `{ admin }`; you can't change your own admin flag (item disabled, like today).
- **Hunters:** no detail view (mockup has none); ⋯ menu = "Voertuig" (submenu with the four vehicles, radio), "Op kaart", "Google Maps". "Op kaart" closes Beheer then flies the map (current `HuntersDialog.showOnMap` behaviour, incl. `setSheetSnap('peek')` on phones).

---

### Task 1: Server — broadcast history

**Files:** Modify `src/routes/admin.route.ts`, `src/controllers/notifications.controller.ts`; Test: add to the existing admin/notifications route tests (find where `POST /admin/broadcast` is tested: `grep -rn "admin/broadcast" src --include=*.test.ts`; if there is none, create `src/controllers/broadcasts.test.ts` with the HTTP pattern of `src/auth/account-flows.test.ts`).

**Produces:** `GET /admin/broadcasts` (`verifyToken`, `isAdmin`) → 200 `NotificationView[]` of `type: "broadcast"`, newest first, at most 20 (`toNotificationView`; the sender is `data.from`). Non-admin → 403.

- [ ] Step 1: failing test — admin posts two broadcasts (`POST /admin/broadcast { message }`), a non-broadcast notification exists too (create an `AppNotification` of another type directly); `GET /admin/broadcasts` returns only the two, newest first, each with `body`, `data.from` (the admin's name) and `createdAt`; a normal user gets 403.
- [ ] Step 2: run, see it fail (404).
- [ ] Step 3: implement

```ts
/** GET /admin/broadcasts: the latest HQ messages (notifications live 48 hours), newest first. */
export async function listBroadcasts(_req: Request, res: Response) {
  const latest = await AppNotification.find({ type: "broadcast" }).sort({ createdAt: -1 }).limit(20).lean();
  return res.status(200).json(latest.map(toNotificationView));
}
```

and `router.get("/broadcasts", [verifyToken, isAdmin], notificationsController.listBroadcasts);` next to the `/broadcast` POST.
- [ ] Step 4: focused test passes; full suite, typecheck, lint pass.
- [ ] Step 5: commit `feat(admin): list recent HQ broadcasts`.

---

### Task 2: Client — store, helpers, hooks

**Files:**
- Modify: `src/stores/admin.store.ts`, `src/lib/response-shape.ts` (+ its test)
- Create: `src/lib/beheer.ts`, `src/lib/beheer.test.ts`, `src/hooks/invites.hook.ts`, `src/hooks/broadcasts.hook.ts`

**Interfaces produced (used by Tasks 3–6):**

`src/stores/admin.store.ts`:
```ts
export type AdminDialogId = 'algemeen' | 'users' | 'invites' | 'hunters' | 'broadcast' | 'koppelingen';
// unchanged shape: { dialog: AdminDialogId | null; openDialog(dialog: AdminDialogId): void; close(): void }
```

`src/lib/beheer.ts`:
```ts
export interface AdminInvite {
  _id: string; code: string; url: string;
  createdBy: { _id: string; name: string } | null;
  createdAt: string; expiresAt: string | null; maxUses: number | null; uses: number; revokedAt: string | null;
  state: 'active' | 'expired' | 'revoked' | 'full';
}
export interface Broadcast { id: string; body: string; data: { from?: string }; createdAt: string }

export const EXPIRY_OPTIONS: { value: InviteExpiry; label: string }[];   // see table
export type InviteExpiry = '30m' | '1h' | '6h' | '12h' | '1d' | '7d' | 'never';
export const MAX_USES_OPTIONS: { value: number | null; label: string }[]; // see table
export const DEFAULT_EXPIRY: InviteExpiry = '1d';
export const DEFAULT_MAX_USES: number | null = null;

export function userMeta(user: { passkeyCount?: number; lastActiveAt?: string | null }, now: number): string;
export function inviteMeta(invite: AdminInvite, now: number): string;
export function formatTimeLeft(iso: string, now: number): string;
export function broadcastMeta(broadcast: Broadcast): string;
export function splitUsers<T extends { admin: boolean; name: string }>(users: T[]): { admins: T[]; members: T[] };
```

Option tables (exact labels):

| expiry value | label |
|---|---|
| `30m` | 30 minuten |
| `1h` | 1 uur |
| `6h` | 6 uur |
| `12h` | 12 uur |
| `1d` | 1 dag |
| `7d` | 7 dagen |
| `never` | Nooit |

| maxUses value | label |
|---|---|
| `1` | 1 keer |
| `5` | 5 keer |
| `10` | 10 keer |
| `25` | 25 keer |
| `50` | 50 keer |
| `100` | 100 keer |
| `null` | Onbeperkt |

(Order in the select: as listed; for max uses put `Onbeperkt` first.)

Formats:
- `userMeta`: passkeys part = `Geen passkey` (0/undefined) | `1 passkey` | `{n} passkeys`; activity part = `nooit actief` when `lastActiveAt` is null, `nu actief` when < 5 min ago, else `formatAgo(lastActiveAt, now)` from `src/lib/account.ts`. Joined with ` · `. E.g. `2 passkeys · nu actief`, `Geen passkey · 3 dagen geleden`.
- `formatTimeLeft(iso, now)`: `nog {m} min` under an hour (min 1), `nog {h} uur` under two days (floor), else `nog {d} dagen`; past → `verlopen`.
- `inviteMeta` parts joined by ` · `:
  - uses: `maxUses === 1` → `Eenmalig` (or `Gebruikt` when `uses >= 1`); `maxUses` set → `{uses} van {maxUses} gebruikt`; `null` → `{uses} gebruikt`.
  - time (active only): `expiresAt === null` → `verloopt nooit`, else `formatTimeLeft`.
  - stopped state instead of the time part: `expired` → `verlopen`, `revoked` → `ingetrokken`, `full` → `vol`.
  - creator: `createdBy?.name` (omit when null).
  - E.g. `7 van 25 gebruikt · nog 6 uur · Silke`, `Eenmalig · nog 52 min · Silke`, `14 gebruikt · verloopt nooit · Mark`, `3 van 3 gebruikt · vol · Silke`.
- `broadcastMeta`: `{data.from ?? 'HQ'} · {formatClock(createdAt)}` (`formatClock` from `src/lib/format.ts`, e.g. `Silke · 11:42`).
- `splitUsers`: admins and members, each sorted by name (`localeCompare(…, 'nl')`).

Hooks:
- `src/hooks/invites.hook.ts`:
  - `useInvites(enabled: boolean)` → `{ invites: AdminInvite[] | undefined; error; create(expiry: InviteExpiry, maxUses: number | null): Promise<AdminInvite>; revoke(id: string): Promise<void> }` — SWR `/admin/invites` (refresh 30 s, null key when disabled); `create` = `POST /admin/invites { expiry, maxUses }` (send `maxUses: null` explicitly — the server's validator needs the key present), `revoke` = `DELETE /admin/invites/:id`; both revalidate; throw axios errors.
  - `useInvitesPaused()` → `{ paused: boolean | undefined; setPaused(paused: boolean): Promise<void> }` — `GET/PUT /settings/invites-paused` (`{ paused }`), same pattern as `usePredictionSetting` in `src/hooks/predictions.hook.ts`.
- `src/hooks/broadcasts.hook.ts`: `useBroadcasts(enabled: boolean)` → `{ broadcasts: Broadcast[] | undefined; send(message: string): Promise<void> }` — SWR `/admin/broadcasts` (refresh 30 s); `send` = `POST /admin/broadcast { message }` with `SLOW_REQUEST_TIMEOUT_MS` (as `BroadcastDialog` does today), then revalidate.
- `src/lib/response-shape.ts`: add `/admin/invites` and `/admin/broadcasts` to the list-returning paths and `'/settings/invites-paused': (data) => typeof data.paused === 'boolean'` to the object checks; extend its test.

- [ ] Step 1: write `src/lib/beheer.test.ts` covering every format above (the example strings listed are test cases; add edge cases: 0/1/2 passkeys, `lastActiveAt` null, `nu actief` boundary at 5 min, `formatTimeLeft` 59 s → `nog 1 min`, 90 min → `nog 1 uur`, 47 h → `nog 47 uur`, 3 days → `nog 3 dagen`, past → `verlopen`, each invite state, `createdBy` null, `splitUsers` order).
- [ ] Step 2: run → fails (module missing).
- [ ] Step 3: implement `src/lib/beheer.ts`; tests pass.
- [ ] Step 4: store type change (check every `openDialog(`/`dialog ===` use still type-checks; the three old dialog ids `'hunters' | 'users' | 'broadcast'` stay valid), hooks, response-shape (+ test).
- [ ] Step 5: `npx --yes bun test && npx --yes bun x tsc -b && npx --yes bun run lint`; commit `feat(beheer): admin store sections, invite/broadcast helpers and hooks`.

---

### Task 3: Client — Beheer window shell + Algemeen + gear menu

**Files:**
- Create: `src/components/beheer/BeheerDialog.tsx`, `src/components/beheer/BeheerLayout.tsx` (exports `BeheerPane`, `BeheerGroup`, `BeheerRow`), `src/components/beheer/AlgemeenPane.tsx`
- Modify: `src/components/Settings.tsx`, `src/Layout.tsx`
- Delete: `src/components/settings/AdminSubmenu.tsx` (after Settings no longer imports it)

**Interfaces produced:**
```tsx
// BeheerLayout.tsx
export function BeheerPane(props: { title: string; description: ReactNode; action?: ReactNode; children: ReactNode }): JSX.Element; // h2 + muted line (+ right-aligned action) then children with gap-7
export function BeheerGroup(props: { title: string; note?: ReactNode; children: ReactNode }): JSX.Element; // heading + rounded-lg border divide-y box (+ muted text-xs note under it)
export function BeheerRow(props: { title: ReactNode; meta?: ReactNode; children?: ReactNode /* trailing control */; className?: string }): JSX.Element;
// BeheerDialog.tsx — default export, props { mapRef: RefObject<MapRef | null> } (passed on to the Hunters pane in Task 4)
```

Behaviour:
- `BeheerDialog` renders only for admins (`useAuthUser<User>()?.admin`). `open = dialog !== null`; `onClose = close`. Use `ResponsiveDialog` with `title="Beheer"`, `description="Instellingen, gebruikers, invites, hunters en koppelingen."`, `hideHeader`, `className="sm:max-w-[900px] p-0 gap-0 overflow-hidden"` (check `DialogContent`'s default padding/close button still look right; the close X stays top-right).
- Sections (in this order, icons from lucide): Algemeen (`SlidersHorizontalIcon`), Gebruikers (`UsersIcon`, count = users), Invites (`UserPlusIcon`, count = active invites), Hunters (`MapPinIcon`, count = trackers), Bericht versturen (`MegaphoneIcon`), Koppelingen (`PlugIcon`), and at the bottom HQ-scherm (`MonitorIcon` + `ExternalLinkIcon size-3.5`) → `window.open('/hq', '_blank', 'noopener')`. Counts come from `useAdmin().users.length`, `useInvites(open).invites?.filter(state==='active').length`, `useDevices().devices.length`; show nothing while unknown.
- Desktop: grid `[210px_1fr]`, fixed height `h-[600px] max-h-[85dvh]`; the content column scrolls (`overflow-y-auto`). Clicking a section calls `openDialog(section)`.
- Phone: the drawer shows the list first; selecting a section shows the pane with a header row (ghost icon button `ArrowLeftIcon`, aria-label "Terug", + section title). Back returns to the list. Keep which view is shown in local state that resets to the list each time the window opens, unless it was opened on a specific section (e.g. `/users` route opens `users` directly → start in that pane).
- Panes not built yet (Tasks 4–6) render a placeholder pane with their title and the line "Komt eraan." — Tasks 4–6 replace them.
- **AlgemeenPane**: `BeheerPane` title "Algemeen", description "Instellingen die voor iedereen gelden.".
  - Group "Functies":
    - "AI-voorspelling" / "Laat Gemini bij elke hint voorspellen waar de vos zit." — `Switch` bound to `usePredictionSetting()` (disabled while `enabled === undefined`; checked = `enabled !== false`; failure → `toast.error('AI-voorspelling wisselen is mislukt')`).
    - "Demo mode" / "Iedereen ziet demo-gegevens. De echte gegevens blijven bewaard." — `Switch` checked = `demo?.enabled`; changing it opens the existing `DemoModeDialog` (which confirms and reloads); disabled while `demo` is undefined.
    - "Invites pauzeren" / "Alle invite-links werken tijdelijk niet." — `Switch` bound to `useInvitesPaused()`; success toast `Invites gepauzeerd` / `Invites werken weer`; failure `toast.error('Invites pauzeren is mislukt')`.
  - Group "Gegevens": "Teams herladen uit API" / "Reset alle ingevulde deelgebieden. Kan niet ongedaan worden gemaakt." — `Button variant="outline" size="sm" className="text-destructive"` "Herladen" → existing `ReloadTeamsDialog`.
- **Settings.tsx**: replace `<AdminSubmenu …/>` with a `DropdownMenuItem` (`ShieldIcon`) "Beheer" → `openDialog('algemeen')` (and close the menu like the other items do). Remove `demoDialogOpen`/`reloadTeamsOpen` state and their dialog mounts from Settings (they now live in AlgemeenPane). Keep Debug.
- **Layout.tsx**: replace `<HuntersDialog mapRef={mapRef}/>`, `<UsersDialog/>`, `<BroadcastDialog/>` with `<BeheerDialog mapRef={mapRef}/>`. Until Tasks 4–5 land, leave the old dialog files in place but unmounted (they are deleted in Tasks 4–5).
- Animations per Global Constraints (pane swap with SWAP keyed by section; phone list ↔ pane slide; counts fade in when they arrive).

- [ ] Steps: build `BeheerLayout` → `BeheerDialog` shell → `AlgemeenPane` → Settings + Layout wiring → delete `AdminSubmenu.tsx`; verify (`bun test`, `tsc -b`, lint, vite build); commit `feat(beheer): Beheer window with side menu and Algemeen`.

---

### Task 4: Client — Gebruikers and Hunters panes

**Files:** Create `src/components/beheer/UsersPane.tsx`, `src/components/beheer/HuntersPane.tsx`, `src/components/beheer/RenameUserDialog.tsx`; modify `BeheerDialog.tsx` (replace the placeholders); delete `src/components/admin/UsersDialog.tsx`, `UsersPanel.tsx`, `HuntersDialog.tsx`, `HuntersPanel.tsx` once nothing imports them (grep first; keep `RecoveryLinkDialog.tsx`, `src/lib/hunters.ts`, `useAdmin`).

**UsersPane:** `BeheerPane` title "Gebruikers", description `{n} accounts. Nieuwe mensen komen binnen via een invite.` (`1 account.` when one). Groups "Admins" and "Leden" from `splitUsers(users)`; empty group hidden. Row: title = name (append ` (jij)` in muted text for the current user), meta = `userMeta(user, now)` (`now` from `useNow(true)`), trailing ⋯ (`EllipsisIcon`, aria-label `Opties voor {name}`) menu:
- "Herstel-link maken" (`LifeBuoyIcon`) → existing `RecoveryLinkDialog` (`createLink` from `useAdmin`).
- "Naam wijzigen" (`PencilIcon`) → `RenameUserDialog` (small shadcn Dialog: title "Naam wijzigen", Input maxLength 40, "Annuleren"/"Opslaan"; `updateUser({ ...user, name })`; error → inline `Reveal` line with `apiErrorMessage(error, 'De naam kon niet worden opgeslagen.')`; success toast `Naam opgeslagen`).
- "Admin maken" / "Admin afnemen" (`ShieldIcon` / `ShieldOffIcon`) → `updateUser({ ...user, admin: !user.admin })`; disabled for yourself; success toast `{name} is nu admin` / `{name} is geen admin meer`; error toast `apiErrorMessage(error, 'Opslaan is mislukt.')` (shows the server's "Er moet minstens één admin overblijven.").
- separator, "Verwijderen" (`Trash2Icon`, destructive variant) → `ConfirmDialog` title `{name} verwijderen?`, description "Het account en alle sessies worden verwijderd. Dit kan niet ongedaan worden gemaakt.", confirmLabel "Verwijderen", destructive; success toast `{name} verwijderd`; error toast `apiErrorMessage(error, 'De gebruiker kon niet worden verwijderd.')`. Disabled for yourself.
- Loading: skeleton group. Rows animate in/out (fade + height).
Note `useAdmin().updateUser`/`deleteUser` resolve to `null` on success or the error (see `src/hooks/admin.hook.ts`) — handle that contract.

**HuntersPane:** `BeheerPane` title "Hunters", description `{n} trackers, {live} live.` Rows from `hunterRows(devices, positions, users, GROUPS, now)` (`src/lib/hunters.ts`; `GROUPS = vehicleGroupIdsFromEnv(import.meta.env)`, `now` ticking every 15 s as `HuntersPanel` does). Groups "Live" (`row.active`) and "Niet live". Row title = device name (with the linked user's name in the meta if it differs: start meta with `{user.name} · ` when there is a user and it isn't the same as the device name); meta = `joinParts(vehicleLabel, formatLastUpdate(row.lastUpdate, now), formatBattery(row.batteryPercent), row.active ? formatSpeed(row.speedKmh) : undefined)` (helpers in `src/lib/tracker.ts`; drop parts that are `undefined`/`'–'`). Trailing ⋯ menu: submenu "Voertuig" (radio items Lopend / Fiets / Auto / Motor from `VEHICLE_OPTIONS`, current one checked) → `setDeviceVehicle(device.id, value)` with today's toasts (`Voertuig van {name} aangepast`; error "Voertuig aanpassen is mislukt" + `apiErrorMessage(error, 'Probeer het opnieuw.')`); "Op kaart" (`LocateFixedIcon`, disabled without position) → `close()` the Beheer window, then on phones `useSidebarStore.getState().setSheetSnap('peek')`, then `mapRef.current?.flyTo({ center: [lng, lat], duration: 2000, zoom: 16 })`; "Google Maps" (`ExternalLinkIcon`, disabled without position) → open `googleMapsUrl(lat, lng)` in a new tab. Empty: muted row "Er zijn nog geen trackers.".

- [ ] Steps: RenameUserDialog → UsersPane → HuntersPane → wire into BeheerDialog → delete the old admin dialogs/panels (grep for imports, incl. tests and the tour) → verify (`bun test`, `tsc -b`, lint, vite build) → commit `feat(beheer): Gebruikers and Hunters panes`.

---

### Task 5: Client — Invites and Bericht versturen panes

**Files:** Create `src/components/beheer/InvitesPane.tsx`, `src/components/beheer/InviteQrDialog.tsx`, `src/components/beheer/BroadcastPane.tsx`; modify `BeheerDialog.tsx`; delete `src/components/admin/BroadcastDialog.tsx`.

**InvitesPane:** `BeheerPane` title "Invites", description "Iedereen met een link kan een account maken.", action = primary `Button size="sm"` (`PlusIcon`) "Nieuwe invite" which toggles the create block (hidden while the block is open).
- Create block (inside `Reveal`, above the lists): `BeheerGroup` "Nieuwe invite" with rows "Verloopt na" (`Select` `w-32`, `EXPIRY_OPTIONS`, default `DEFAULT_EXPIRY`) and "Aantal keer" (`Select` `w-32`, `MAX_USES_OPTIONS`, default Onbeperkt); under the box two buttons right-aligned: "Annuleren" (ghost) and "Maken" (primary, spinner while busy). On success: close the block, highlight the new row in "Actief" (accent background fading out over 1.2 s), copy its link to the clipboard (`copyToClipboard` from `@/lib/clipboard`) and `toast.success('Invite gemaakt', { description: 'De link staat op je klembord.' })`. Error → `Reveal`ed line `apiErrorMessage(error, 'Invite maken is mislukt.')`.
- Group "Actief" (`state === 'active'`): row title = code (`font-mono`), meta = `inviteMeta(invite, now)`; trailing an outline `h-8 px-3` button "Kopieer" (copies `invite.url`, toast `Link gekopieerd`) and a ⋯ menu: "QR-code tonen" (`QrCodeIcon`) → `InviteQrDialog`; separator; "Intrekken" (destructive) → `ConfirmDialog` title `Invite {code} intrekken?`, description "De link werkt daarna niet meer. Accounts die er al mee gemaakt zijn blijven bestaan.", confirmLabel "Intrekken", destructive → `revoke(id)`, toast `Invite ingetrokken`. Empty group: muted row "Geen actieve invites.". Note under the group: none.
- Group "Gestopt" (other states, only when not empty): same rows, no Kopieer, no menu, title muted.
- `InviteQrDialog`: small shadcn Dialog, title `Invite {code}`, description "Laat iemand deze code scannen om een account te maken.", `TrackerQrCode value={url} size={220} label="QR-code van de invite"`, the URL in a readonly mono `Input` + `CopyButton value={url} label="Link"`, meta line `inviteMeta`.
- `now` via `useNow(true)`. Rows animate in/out.

**BroadcastPane:** `BeheerPane` title "Bericht versturen", description "Iedereen krijgt dit als melding met geluid."
- Group "Nieuw bericht": inside the box a padded block with `Textarea` (`maxLength={200}`, `rows={3}`, placeholder "Bijv. Iedereen terug naar HQ"), then a row: counter `{n} / 200` (`tabular-nums`, muted) and primary `Button size="sm"` (`SendIcon`) "Versturen" (disabled while empty/sending). `send(trimmed)` → toast `Bericht verstuurd`, clear the text; error → `toast.error('Versturen is mislukt, probeer het opnieuw.')`.
- Group "Eerder verstuurd": rows title = `body`, meta = `broadcastMeta`. Empty: muted row "Nog niets verstuurd in de laatste 48 uur.". New rows animate in at the top.

- [ ] Steps: InviteQrDialog → InvitesPane → BroadcastPane → wire → delete `BroadcastDialog.tsx` (grep imports) → verify (`bun test`, `tsc -b`, lint, vite build) → commit `feat(beheer): Invites and Bericht versturen panes`.

---

### Task 6: Client — Koppelingen pane

**Files:** Create `src/components/beheer/KoppelingenPane.tsx`; modify `BeheerDialog.tsx`.

`BeheerPane` title "Koppelingen", description "Accounts van de groep.". Group "Accounts":
- **Telegram** row: meta from `useTelegramAdmin(open)` status: `unavailable` → "Niet ingesteld op de server"; `linked` → `Gekoppeld via {account.name} · leest @Jotihunt_bot` (`Geen verbinding · {account.name}` when `connected === false`); `qr`/`password` → "Bezig met koppelen…"; `unlinked` → "Niet gekoppeld"; loading → skeleton meta. Trailing: linked → outline "Ontkoppelen" → `ConfirmDialog` with the existing copy (title "Telegram ontkoppelen?", description "De server logt uit bij Telegram. Tegenhunts worden dan niet meer automatisch gemeld, tot iemand opnieuw koppelt.", confirmLabel "Ontkoppelen", destructive) → `unlink()`; unlinked → primary "Koppelen" → expands (via `Reveal`, under the box) the existing `TelegramLinkPanel` with its callbacks (`link`, `unlink` as cancel, `submitPassword`) — check `TelegramLinkPanel`'s props and how `TelegramSection` wires them, and reuse the same wiring; collapse it automatically once the status becomes `linked` (toast `Telegram gekoppeld`). `unavailable` → no button.
- **Life360** row: from `useLife360Admin(open)`: `unavailable` → "Niet ingesteld op de server"; `linked` → `Gekoppeld via {email}` (use the same field `Life360Card` shows after "Leest via"); `paused` → "Even gepauzeerd"; `loggedOut` → "Uitgelogd, opnieuw koppelen nodig"; link steps → "Bezig met koppelen…"; `unlinked` → "Niet gekoppeld". Trailing: linked/paused → "Ontkoppelen" with the existing confirm copy (title "Life360 ontkoppelen?", description "De server vergeet de Life360-sessie. De Life360-laag verdwijnt van de kaart, tot iemand opnieuw koppelt.", confirmLabel "Ontkoppelen", destructive); unlinked/loggedOut → "Koppelen" → expands the existing `Life360LinkPanel` with the same wiring as `Life360Card` uses (read `Life360Card`/`Life360Section` to reuse `life360View` and the email-step state); collapse on `linked` (toast `Life360 gekoppeld`).
- Sidebar cards stay unchanged.

- [ ] Steps: read `TelegramSection`/`TelegramCard`/`TelegramLinkPanel` and `Life360Section`/`Life360Card`/`Life360LinkPanel` wiring → build the pane → wire → verify (`bun test`, `tsc -b`, lint, vite build) → commit `feat(beheer): Koppelingen pane`.

---

### Task 7: Smoke (controller)

Throwaway server (`PORT=3101`, db `jotihunt-passkey-smoke`, WebAuthn env for localhost:5191, external URLs → `http://127.0.0.1:9`) + vite `:5191`; log in via a herstel-link with a virtual authenticator (playwright-core + CDP WebAuthn, `~/.cache/ms-playwright/chromium_headless_shell-1234`), set `notificationPrefs.promptedVersion`/`tutorialVersion` to 99 in the smoke DB, open Beheer, screenshot each pane (desktop 1280×860 and phone 390×844), create and revoke an invite, toggle invites paused, send a broadcast. Stop both, drop the DB.
