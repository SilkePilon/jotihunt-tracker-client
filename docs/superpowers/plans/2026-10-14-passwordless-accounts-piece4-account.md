# Passwordless accounts, piece 4: Account dialog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every user can see and manage their own passkeys (rename, remove, add) and the places they are logged in (web sessions + paired Android phones), and log out a lost device, from one "Account" dialog in the gear menu.

**Architecture:** Server: one read endpoint `GET /account` (passkeys, live web sessions with `current`, Android devices) plus small write endpoints under `/account` (rename/remove passkey, revoke one/other sessions); Android unpairing reuses `DELETE /auth/devices/:id`. All `/account` routes need a web session. Client: pure formatting helpers in `src/lib/account.ts` (tested), a `useAccount` SWR hook, and `AccountDialog` (`ResponsiveDialog`) in the Beheer-v3 row style, opened from a new "Account" gear-menu item.

**Tech Stack:** Server Bun + Express 5 + Mongoose 9 + express-validator; client React 19 + SWR + react-auth-kit v3 + shadcn + motion v14.

Spec: `docs/superpowers/specs/2026-10-14-passwordless-accounts-design.md` (sections Endpoints → Authenticated, Account dialog, Security notes).

## Global Constraints

- Worktrees: server `/home/silke/Documents/Jotihunt 2026/.worktrees/server-account`, client `/home/silke/Documents/Jotihunt 2026/.worktrees/client-account`, both on branch `feat/account-dialog`. Never touch the main checkouts, the live docker stack (server :3000, client :8080), the k3s cluster or their databases.
- Run bun as `npx --yes bun ...`. Server: `npx --yes bun run test` (has `--timeout 30000`), `npx --yes bun run typecheck`, `npx --yes bun run lint`. Client: `npx --yes bun test`, `npx --yes bun x tsc -b` (needs `node_modules/vite-envs/client.d.ts`; run `npx --yes bun x vite build --outDir /tmp/jh-acct-build` once first if missing, then delete that dir), `npx --yes bun run lint`. Run `npx --yes bun install` first in a fresh worktree.
- Server tests use only Mongo db `jotihunt-test`.
- Passkeys are identified by their `credentialId` (base64url, URL-safe) in URLs — never by subdocument `_id` (demo mode mirrors user writes to a second database where subdocument ids differ).
- Passkey writes go through `updateAccounts` (`src/auth/user-store.ts`) so demo mode mirrors them; sessions live on the auth connection (`sessions()` from `src/auth/models.ts`).
- The last passkey can never be removed (409 `LAST_PASSKEY`), atomically (two tabs removing the last two must leave one).
- A user can only see/revoke their own sessions and passkeys.
- `/account/*` routes: `verifyToken` + `requireWebSession` (paired Android device tokens get 403).
- UI follows the approved Beheer v3 row style: group heading `text-sm font-semibold`, a `rounded-lg border divide-y` box, rows `px-4 py-3` with title `text-sm font-medium` + meta `text-xs text-muted-foreground` and one trailing control. Keep it plain (no cards-in-cards, no sidebar).
- **Animations (user requirement):** nothing appears or disappears without animation. Rows enter/exit with `AnimatePresence` (fade + height), inline errors use `Reveal` (`src/components/motion/Reveal.tsx`), state swaps use `SWAP` from `src/lib/motion.ts`. Respect reduced motion (already global via `MotionConfig reducedMotion="user"`).
- All copy Dutch, exactly as written here.
- Code style: match the surrounding files (server double quotes 2-space; client auth/lib files single quotes 2-space; `Settings.tsx` 4-space, no spaces inside JSX braces).
- Commit after each task; messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Deviations from the spec (decided in planning)

- One `GET /account` instead of `GET /account/passkeys` + `GET /account/sessions` (the dialog always needs both, plus the Android devices).
- `DELETE /account/passkeys/:id` answers 200 `{ user }` (the public user, so the client can update `passkeyCount`), like `POST /account/passkeys/verify`.
- The footer button logs out **other browsers** only ("Alle andere browsers uitloggen"); paired Android phones are unpaired per row (unpairing stops location tracking, so it should never happen in bulk by accident).

---

### Task 1: Server — account endpoints

**Files:**
- Modify: `src/auth/account.controller.ts`, `src/routes/account.route.ts`
- Create: `src/auth/account-flows.test.ts`

**Interfaces:**
- Consumes: `sessions()`, `SessionDoc` (`src/auth/models.ts`); `updateAccounts` (`src/auth/user-store.ts`); `publicUser` (`src/auth/public-user.ts`); `listDevices(user)` (`src/services/pairing.service.ts`); `isObjectIdString` (`src/utils/mongo.ts`); `verifyToken`, `requireWebSession` (`src/middleware/auth.middleware.ts`); `validate` (`src/middleware/validate.middleware.ts`).
- Produces (HTTP, used by Task 2):
  - `GET /account` → 200 `{ passkeys: [{ id, name, createdAt, lastUsedAt }], sessions: [{ id, label, via, createdAt, lastUsedAt, current }], devices: [{ id, name, createdAt, lastSeenAt }] }`. `sessions` = live web sessions of this user (`expiresAt > now`), most recently used first. `current` = the session making the request.
  - `PATCH /account/passkeys/:id` body `{ name }` (trimmed, 1–40 chars, else 400) → 204; unknown id → 404 `{ message: "Passkey niet gevonden." }`.
  - `DELETE /account/passkeys/:id` → 200 `{ user }`; unknown → 404 (same message); last one → 409 `{ message: "Je laatste passkey kan niet weg, anders kom je niet meer binnen.", code: "LAST_PASSKEY" }`.
  - `DELETE /account/sessions/:id` → 204 (may be the current session: that logs this browser out); not this user's / unknown / malformed → 404 `{ message: "Sessie niet gevonden." }`.
  - `DELETE /account/sessions` → 200 `{ removed: number }`: all of this user's sessions except the current one.

- [ ] **Step 1: Write the failing HTTP tests `src/auth/account-flows.test.ts`**

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { installFakeWebauthn } from "../test/webauthn";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../test/db";
import { tokenFor, withSession } from "../test/auth";
import { User } from "../models/user.model";
import { sessions } from "./models";
import { createAccount } from "./user-store";
import { signDeviceToken } from "../services/access-token";

installFakeWebauthn();
process.env.JWT_SECRET ??= "test-secret-test-secret-test-secret";
process.env.PUBLIC_APP_URL = "https://jotihunt.test";
const { app } = await import("../app");

let server: Server;
let base: string;
beforeAll(async () => {
  await connectTestDb();
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(clearTestDb);
afterAll(async () => {
  server.close();
  await disconnectTestDb();
});

function request(path: string, init: RequestInit & { token?: string; json?: unknown } = {}) {
  const headers = new Headers(init.headers);
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  return fetch(`${base}${path}`, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
}
const json = async <T = Record<string, unknown>>(res: Response) => (await res.json()) as T;
const passkey = (id: string) => ({ credentialId: id, publicKey: Buffer.from(`pk-${id}`), counter: 0, transports: ["internal"], name: `Key ${id}` });
type Overview = {
  passkeys: { id: string; name: string; createdAt: string; lastUsedAt: string | null }[];
  sessions: { id: string; label: string; via: string; current: boolean }[];
  devices: { id: string; name: string }[];
};

async function userWithTwoKeys() {
  const user = await withSession(await createAccount({ name: "Jesse", passkey: passkey("cred-1") }));
  await User.updateOne({ _id: user._id }, { $push: { passkeys: { ...passkey("cred-2"), createdAt: new Date(), lastUsedAt: null } } });
  return user;
}

describe("account overview", () => {
  test("passkeys without key material, own live sessions with current first-class flag, Android devices", async () => {
    const jesse = await userWithTwoKeys();
    await User.updateOne({ _id: jesse._id }, { $push: { devices: { id: "phone-1", name: "Pixel", createdAt: new Date() } } });
    const other = await withSession(await createAccount({ name: "Noor", passkey: passkey("cred-9") }));
    const res = await request("/account", { token: tokenFor(jesse) });
    expect(res.status).toBe(200);
    const body = await json<Overview>(res);
    expect(body.passkeys.map((p) => p.id)).toEqual(["cred-1", "cred-2"]);
    expect(body.passkeys[0].name).toBe("Key cred-1");
    expect(JSON.stringify(body)).not.toContain("pk-cred");
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0]).toMatchObject({ label: "Test", via: "passkey", current: true });
    expect(body.devices.map((d) => d.id)).toEqual(["phone-1"]);
    expect(JSON.stringify(body)).not.toContain(String(other._id));
  });

  test("expired sessions are not listed; device tokens get 403", async () => {
    const jesse = await userWithTwoKeys();
    await sessions().create({ user: jesse._id, label: "Oud", via: "passkey", createdAt: new Date(0), lastUsedAt: new Date(0), expiresAt: new Date(Date.now() - 1000) });
    expect((await json<Overview>(await request("/account", { token: tokenFor(jesse) }))).sessions).toHaveLength(1);
    await User.updateOne({ _id: jesse._id }, { $push: { devices: { id: "phone-1", name: "Pixel", createdAt: new Date() } } });
    expect((await request("/account", { token: signDeviceToken(jesse, "phone-1") })).status).toBe(403);
  });
});

describe("passkeys", () => {
  test("rename: trimmed, 1-40 chars, unknown id 404", async () => {
    const jesse = await userWithTwoKeys();
    const token = tokenFor(jesse);
    expect((await request("/account/passkeys/cred-1", { method: "PATCH", token, json: { name: "  Telefoon  " } })).status).toBe(204);
    expect((await User.findById(jesse._id))!.passkeys[0].name).toBe("Telefoon");
    expect((await request("/account/passkeys/cred-1", { method: "PATCH", token, json: { name: "   " } })).status).toBe(400);
    expect((await request("/account/passkeys/cred-1", { method: "PATCH", token, json: { name: "x".repeat(41) } })).status).toBe(400);
    expect((await request("/account/passkeys/nope", { method: "PATCH", token, json: { name: "A" } })).status).toBe(404);
  });

  test("remove: answers the updated user; the last one is refused with LAST_PASSKEY", async () => {
    const jesse = await userWithTwoKeys();
    const token = tokenFor(jesse);
    const removed = await request("/account/passkeys/cred-1", { method: "DELETE", token });
    expect(removed.status).toBe(200);
    expect((await json<{ user: { passkeyCount: number } }>(removed)).user.passkeyCount).toBe(1);
    const last = await request("/account/passkeys/cred-2", { method: "DELETE", token });
    expect(last.status).toBe(409);
    expect((await json(last)).code).toBe("LAST_PASSKEY");
    expect((await User.findById(jesse._id))!.passkeys).toHaveLength(1);
    expect((await request("/account/passkeys/nope", { method: "DELETE", token })).status).toBe(404);
  });

  test("two removals at the same time never remove the last passkey", async () => {
    const jesse = await userWithTwoKeys();
    const token = tokenFor(jesse);
    await Promise.all([
      request("/account/passkeys/cred-1", { method: "DELETE", token }),
      request("/account/passkeys/cred-2", { method: "DELETE", token }),
    ]);
    expect((await User.findById(jesse._id))!.passkeys).toHaveLength(1);
  });

  test("another user's passkey is 404", async () => {
    await userWithTwoKeys();
    const noor = await withSession(await createAccount({ name: "Noor", passkey: passkey("cred-9") }));
    expect((await request("/account/passkeys/cred-1", { method: "DELETE", token: tokenFor(noor) })).status).toBe(404);
  });
});

describe("sessions", () => {
  test("revoke one (own only), then all others; the current one keeps working", async () => {
    const jesse = await userWithTwoKeys();
    const current = tokenFor(jesse);
    await withSession(jesse);
    const second = tokenFor(jesse);
    await withSession(jesse);
    const third = tokenFor(jesse);
    const noor = await withSession(await createAccount({ name: "Noor", passkey: passkey("cred-9") }));

    const list = (await json<Overview>(await request("/account", { token: current }))).sessions;
    expect(list).toHaveLength(3);
    const secondId = list.find((s) => !s.current)!.id;

    expect((await request(`/account/sessions/${secondId}`, { method: "DELETE", token: tokenFor(noor) })).status).toBe(404);
    expect((await request("/account/sessions/not-an-id", { method: "DELETE", token: current })).status).toBe(404);
    expect((await request(`/account/sessions/${secondId}`, { method: "DELETE", token: current })).status).toBe(204);

    const others = await request("/account/sessions", { method: "DELETE", token: current });
    expect(others.status).toBe(200);
    expect((await json(others)).removed).toBe(1);
    expect((await request("/auth/me", { token: current })).status).toBe(200);
    expect((await request("/auth/me", { token: second })).status).toBe(401);
    expect((await request("/auth/me", { token: third })).status).toBe(401);
    expect((await request("/auth/me", { token: tokenFor(noor) })).status).toBe(200);
  });

  test("revoking the current session logs this browser out", async () => {
    const jesse = await userWithTwoKeys();
    const token = tokenFor(jesse);
    const [own] = (await json<Overview>(await request("/account", { token }))).sessions;
    expect((await request(`/account/sessions/${own.id}`, { method: "DELETE", token })).status).toBe(204);
    expect((await request("/auth/me", { token })).status).toBe(401);
  });
});
```

Note: `withSession` in `src/test/auth.ts` creates sessions with label `"Test"` and via `"passkey"`, and keeps only the latest token per user — that is why the tests capture `tokenFor(jesse)` right after each `withSession` call.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx --yes bun test src/auth/account-flows.test.ts`
Expected: FAIL (`GET /account` is 404).

- [ ] **Step 3: Add the handlers to `src/auth/account.controller.ts`**

Add imports (merge with the existing ones):

```ts
import { listDevices } from "../services/pairing.service";
import { isObjectIdString } from "../utils/mongo";
import { sessions, type SessionDoc } from "./models";
```

Append:

```ts
const PASSKEY_NOT_FOUND = { message: "Passkey niet gevonden." };
const LAST_PASSKEY = { message: "Je laatste passkey kan niet weg, anders kom je niet meer binnen.", code: "LAST_PASSKEY" };
const SESSION_NOT_FOUND = { message: "Sessie niet gevonden." };

/** Everything the Account dialog shows: passkeys (no key material), live web sessions and paired Android phones. */
export async function overview(req: Request, res: Response) {
  const user = req.user!;
  const live = await sessions()
    .find({ user: user._id, expiresAt: { $gt: new Date() } })
    .sort({ lastUsedAt: -1 })
    .lean<SessionDoc[]>();
  return res.status(200).json({
    passkeys: user.passkeys.map((passkey) => ({ id: passkey.credentialId, name: passkey.name, createdAt: passkey.createdAt, lastUsedAt: passkey.lastUsedAt ?? null })),
    sessions: live.map((session) => ({
      id: String(session._id),
      label: session.label,
      via: session.via,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      current: String(session._id) === res.locals.sessionId,
    })),
    devices: listDevices(user),
  });
}

export async function renamePasskey(req: Request, res: Response) {
  const user = req.user!;
  const id = String(req.params.id);
  if (!user.passkeys.some((passkey) => passkey.credentialId === id)) return res.status(404).json(PASSKEY_NOT_FOUND);
  await updateAccounts({ _id: user._id, "passkeys.credentialId": id }, { $set: { "passkeys.$.name": String(req.body.name) } });
  return res.status(204).end();
}

export async function removePasskey(req: Request, res: Response) {
  const user = req.user!;
  const id = String(req.params.id);
  if (!user.passkeys.some((passkey) => passkey.credentialId === id)) return res.status(404).json(PASSKEY_NOT_FOUND);
  if (user.passkeys.length <= 1) return res.status(409).json(LAST_PASSKEY);
  // Only while a second passkey exists: two tabs removing the last two at once leave one
  await updateAccounts({ _id: user._id, "passkeys.credentialId": id, "passkeys.1": { $exists: true } }, { $pull: { passkeys: { credentialId: id } } });
  const updated = await User.findById(user._id);
  if (updated?.passkeys.some((passkey) => passkey.credentialId === id)) return res.status(409).json(LAST_PASSKEY);
  return res.status(200).json({ user: publicUser(updated!) });
}

/** Log out one browser of this user (also the current one). */
export async function removeSession(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!isObjectIdString(id)) return res.status(404).json(SESSION_NOT_FOUND);
  const result = await sessions().deleteOne({ _id: id, user: req.user!._id });
  return result.deletedCount ? res.status(204).end() : res.status(404).json(SESSION_NOT_FOUND);
}

/** Log out every other browser of this user; this one stays logged in. */
export async function removeOtherSessions(req: Request, res: Response) {
  const result = await sessions().deleteMany({ user: req.user!._id, _id: { $ne: res.locals.sessionId } });
  return res.status(200).json({ removed: result.deletedCount });
}
```

If `updated` can be null (the user was deleted meanwhile), answer 404 `PASSKEY_NOT_FOUND` instead of using the non-null assertion.

- [ ] **Step 4: Add the routes to `src/routes/account.route.ts`**

Add `param` to the express-validator import if needed and these routes (all with the web-session guard):

```ts
const passkeyName = body("name").isString().trim().isLength({ min: 1, max: 40 }).withMessage("Naam moet 1 tot 40 tekens zijn.");

router.get("/", [verifyToken, requireWebSession], accountController.overview);
router.patch("/passkeys/:id", [verifyToken, requireWebSession, validate([passkeyName])], accountController.renamePasskey);
router.delete("/passkeys/:id", [verifyToken, requireWebSession], accountController.removePasskey);
router.delete("/sessions/:id", [verifyToken, requireWebSession], accountController.removeSession);
router.delete("/sessions", [verifyToken, requireWebSession], accountController.removeOtherSessions);
```

Check that `validate`'s `trim()` sanitiser writes the trimmed value back to `req.body.name` (express-validator does when the chain runs); the rename test asserts `"Telefoon"`.

- [ ] **Step 5: Run the account tests, then the full suite, typecheck and lint**

Run: `npx --yes bun test src/auth/account-flows.test.ts` → PASS (9 tests).
Run: `npx --yes bun run test && npx --yes bun run typecheck && npx --yes bun run lint` → all pass.

- [ ] **Step 6: Commit**

```bash
git add src/auth/account.controller.ts src/routes/account.route.ts src/auth/account-flows.test.ts
git commit -m "feat(account): overview, rename/remove passkeys, log out other browsers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Client — account helpers and hook

**Files:**
- Create: `src/lib/account.ts`, `src/lib/account.test.ts`, `src/hooks/account.hook.ts`, `src/stores/account-dialog.store.ts`
- Modify: `src/lib/response-shape.ts` (shape check for `/account`)

**Interfaces:**
- Consumes: Task 1's HTTP contract; `useAuthSWR`, `fetcherWithMethod` (`src/lib/swr.ts`); `useAuth().updateUserState` (`src/hooks/auth.hook.ts`); `User` (`src/types/User`).
- Produces (used by Task 3):
  - `src/lib/account.ts`: types `AccountPasskey`, `AccountSession`, `AccountDevice`, `AccountOverview`; `formatAgo(iso: string, now: number): string`; `formatDay(iso: string): string`; `passkeyMeta(passkey, now): string`; `sessionMeta(session, now): string`; `deviceMeta(device, now): string`; `orderSessions(sessions): AccountSession[]`.
  - `src/hooks/account.hook.ts`: `useAccount(enabled: boolean)` → `{ account?: AccountOverview; error: unknown; renamePasskey(id, name): Promise<void>; removePasskey(id): Promise<void>; removeSession(id): Promise<void>; removeOtherSessions(): Promise<number>; removeDevice(id): Promise<void>; refresh(): Promise<unknown> }`. Every action throws the axios error on failure and revalidates `/account` on success; `removePasskey` also updates the stored user (`passkeyCount`) via `updateUserState`.
  - `src/stores/account-dialog.store.ts`: zustand `{ open: boolean; setOpen(open: boolean) }` (same shape as `src/stores/notifications-dialog.store.ts`).

- [ ] **Step 1: Write the failing tests `src/lib/account.test.ts`**

```ts
import { describe, expect, test } from 'bun:test';
import { deviceMeta, formatAgo, formatDay, orderSessions, passkeyMeta, sessionMeta, type AccountSession } from './account';

const now = Date.parse('2026-10-17T12:00:00Z');
const ago = (ms: number) => new Date(now - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('formatAgo', () => {
  test('zojuist, minutes, hours, gisteren, days', () => {
    expect(formatAgo(ago(30_000), now)).toBe('zojuist');
    expect(formatAgo(ago(5 * MIN), now)).toBe('5 min geleden');
    expect(formatAgo(ago(3 * HOUR), now)).toBe('3 uur geleden');
    expect(formatAgo(ago(30 * HOUR), now)).toBe('gisteren');
    expect(formatAgo(ago(5 * DAY), now)).toBe('5 dagen geleden');
    expect(formatAgo(new Date(now + MIN).toISOString(), now)).toBe('zojuist');
  });
});

describe('formatDay', () => {
  test('day and short month in Dutch, no trailing dot', () => {
    expect(formatDay('2026-10-03T10:00:00Z')).toBe('3 okt');
    expect(formatDay('2026-05-21T10:00:00Z')).toBe('21 mei');
  });
});

describe('meta lines', () => {
  test('passkey: created, last used or never used', () => {
    expect(passkeyMeta({ id: 'a', name: 'x', createdAt: '2026-10-03T10:00:00Z', lastUsedAt: ago(30_000) }, now)).toBe('Gemaakt 3 okt · laatst gebruikt zojuist');
    expect(passkeyMeta({ id: 'a', name: 'x', createdAt: '2026-10-03T10:00:00Z', lastUsedAt: null }, now)).toBe('Gemaakt 3 okt · nog niet gebruikt');
  });

  test('session: this device first, else last used; how it logged in', () => {
    const base = { id: 's', label: 'Firefox op Linux', createdAt: ago(DAY), lastUsedAt: ago(5 * MIN) };
    expect(sessionMeta({ ...base, via: 'passkey', current: true }, now)).toBe('Dit apparaat · met passkey');
    expect(sessionMeta({ ...base, via: 'qr', current: false }, now)).toBe('5 min geleden · met QR-code');
    expect(sessionMeta({ ...base, via: 'invite', current: false }, now)).toBe('5 min geleden · via invite');
    expect(sessionMeta({ ...base, via: 'herstel', current: false }, now)).toBe('5 min geleden · via herstel-link');
    expect(sessionMeta({ ...base, via: 'cli', current: false }, now)).toBe('5 min geleden · via herstel-link');
  });

  test('device: Android app and when last seen', () => {
    expect(deviceMeta({ id: 'd', name: 'Pixel', createdAt: ago(DAY), lastSeenAt: ago(3 * HOUR) }, now)).toBe('Android-app · 3 uur geleden');
    expect(deviceMeta({ id: 'd', name: 'Pixel', createdAt: ago(DAY), lastSeenAt: null }, now)).toBe('Android-app · nog niet gezien');
  });
});

describe('orderSessions', () => {
  test('current first, then most recently used', () => {
    const make = (id: string, minutesAgo: number, current = false): AccountSession => ({ id, label: id, via: 'passkey', createdAt: ago(DAY), lastUsedAt: ago(minutesAgo * MIN), current });
    expect(orderSessions([make('old', 50), make('me', 90, true), make('new', 1)]).map((s) => s.id)).toEqual(['me', 'new', 'old']);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx --yes bun test src/lib/account.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/account.ts`**

```ts
export interface AccountPasskey {
  /** The credential id (base64url) */
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export type SessionVia = 'passkey' | 'invite' | 'herstel' | 'qr' | 'cli';

export interface AccountSession {
  id: string;
  /** "Firefox op Linux" */
  label: string;
  via: SessionVia;
  createdAt: string;
  lastUsedAt: string;
  /** The browser looking at the dialog */
  current: boolean;
}

export interface AccountDevice {
  id: string;
  name: string;
  createdAt: string;
  lastSeenAt: string | null;
}

export interface AccountOverview {
  passkeys: AccountPasskey[];
  sessions: AccountSession[];
  devices: AccountDevice[];
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "zojuist", "5 min geleden", "3 uur geleden", "gisteren", "5 dagen geleden". */
export function formatAgo(iso: string, now: number): string {
  const elapsed = Math.max(0, now - Date.parse(iso));
  if (elapsed < MIN) return 'zojuist';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MIN)} min geleden`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} uur geleden`;
  if (elapsed < 2 * DAY) return 'gisteren';
  return `${Math.floor(elapsed / DAY)} dagen geleden`;
}

const dayFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' });

/** "3 okt" */
export function formatDay(iso: string): string {
  return dayFormat.format(new Date(iso)).replace(/\.$/, '');
}

export function passkeyMeta(passkey: AccountPasskey, now: number): string {
  return `Gemaakt ${formatDay(passkey.createdAt)} · ${passkey.lastUsedAt ? `laatst gebruikt ${formatAgo(passkey.lastUsedAt, now)}` : 'nog niet gebruikt'}`;
}

const VIA_TEXT: Record<SessionVia, string> = {
  passkey: 'met passkey',
  qr: 'met QR-code',
  invite: 'via invite',
  herstel: 'via herstel-link',
  cli: 'via herstel-link',
};

export function sessionMeta(session: AccountSession, now: number): string {
  return `${session.current ? 'Dit apparaat' : formatAgo(session.lastUsedAt, now)} · ${VIA_TEXT[session.via] ?? VIA_TEXT.passkey}`;
}

export function deviceMeta(device: AccountDevice, now: number): string {
  return `Android-app · ${device.lastSeenAt ? formatAgo(device.lastSeenAt, now) : 'nog niet gezien'}`;
}

/** This browser first, then the most recently used. */
export function orderSessions(sessions: AccountSession[]): AccountSession[] {
  return [...sessions].sort((a, b) => Number(b.current) - Number(a.current) || Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt));
}
```

If `formatDay` produces something other than `3 okt` in Bun's ICU (e.g. `3 okt.`), keep the regex approach and adjust only the normalisation, not the test.

- [ ] **Step 4: Run the tests** → `npx --yes bun test src/lib/account.test.ts` PASS (7 tests).

- [ ] **Step 5: Register the response shape**

In `src/lib/response-shape.ts`, add to `OBJECT_CHECKS`:

```ts
  '/account': (data) => Array.isArray(data.passkeys) && Array.isArray(data.sessions) && Array.isArray(data.devices),
```

and add a case for it to the existing `src/lib/response-shape.test.ts` following the pattern of the other object checks there (one valid, one invalid object).

- [ ] **Step 6: Implement `src/stores/account-dialog.store.ts`**

```ts
import { create } from 'zustand';

interface AccountDialogState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

/** The "Account" dialog (passkeys and logged-in devices), opened from the gear menu. */
const useAccountDialogStore = create<AccountDialogState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

export default useAccountDialogStore;
```

- [ ] **Step 7: Implement `src/hooks/account.hook.ts`**

```ts
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import { useAuth } from '@/hooks/auth.hook';
import type { AccountOverview } from '@/lib/account';
import type { User } from '@/types/User';

/** The Account dialog's data and actions; only fetches while `enabled` (the dialog is open). Actions throw the axios error. */
export function useAccount(enabled: boolean) {
  const authHeader = useAuthHeader() || '';
  const { updateUserState } = useAuth();
  const { data, error, mutate } = useAuthSWR<AccountOverview>(enabled ? '/account' : null, { refreshInterval: 30_000 });
  const call = (path: string, method: 'PATCH' | 'DELETE', body?: unknown) => fetcherWithMethod(path, authHeader, method, body);
  const passkeyPath = (id: string) => `/account/passkeys/${encodeURIComponent(id)}`;

  return {
    account: data,
    error,
    refresh: () => mutate(),
    async renamePasskey(id: string, name: string) {
      await call(passkeyPath(id), 'PATCH', { name });
      await mutate();
    },
    async removePasskey(id: string) {
      const { user } = (await call(passkeyPath(id), 'DELETE')) as { user: User };
      await updateUserState(user);
      await mutate();
    },
    async removeSession(id: string) {
      await call(`/account/sessions/${encodeURIComponent(id)}`, 'DELETE');
      await mutate();
    },
    async removeOtherSessions() {
      const { removed } = (await call('/account/sessions', 'DELETE')) as { removed: number };
      await mutate();
      return removed;
    },
    async removeDevice(id: string) {
      await call(`/auth/devices/${encodeURIComponent(id)}`, 'DELETE');
      await mutate();
    },
  };
}
```

Check `fetcherWithMethod` handles a 204 (empty body): `response.data?.error` on `''` is fine. If `useAuth().updateUserState` has a different signature, follow `src/components/AddPasskeyPrompt.tsx`.

- [ ] **Step 8: Verify and commit**

Run: `npx --yes bun test && npx --yes bun x tsc -b && npx --yes bun run lint` → all pass.

```bash
git add src/lib/account.ts src/lib/account.test.ts src/hooks/account.hook.ts src/stores/account-dialog.store.ts src/lib/response-shape.ts src/lib/response-shape.test.ts
git commit -m "feat(account): account overview helpers, hook and dialog store

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Client — Account dialog and gear-menu item

**Files:**
- Create: `src/components/account/AccountDialog.tsx`, `src/components/account/RenamePasskeyDialog.tsx`
- Modify: `src/components/Settings.tsx` (menu item), `src/Layout.tsx` (mount the dialog next to `<NotificationsDialog/>`)

**Interfaces:**
- Consumes: Task 2 (`useAccount`, `useAccountDialogStore`, `passkeyMeta`, `sessionMeta`, `deviceMeta`, `orderSessions`, types); `addPasskey(authHeader)` + `passkeysSupported()` (`src/lib/auth-api.ts`); `classifyPasskeyError`, `PASSKEY_MESSAGES` (`src/lib/passkey.ts`); `useAuth().updateUserState`; `useLogout()` (`src/hooks/logout.hook.ts`); `useNow(active)` (`src/hooks/now.hook.ts`); `ResponsiveDialog` (props `open, onClose, title, description, compact?, className?, onClosed?`); `ConfirmDialog` (`src/components/ConfirmDialog.tsx`: `open, onOpenChange, title, description, confirmLabel, destructive?, onConfirm`); `Reveal`; `SWAP`, `REVEAL_TRANSITION` (`src/lib/motion.ts`); shadcn `Button`, `Input`, `Skeleton`, `DropdownMenu*`, `Dialog*`.

No component test setup exists; logic lives in the tested Task 2 helpers. Verify with tsc/lint/tests/build.

- [ ] **Step 1: Gear-menu item in `src/components/Settings.tsx`**

Import `UserRoundIcon` from `lucide-react` and `useAccountDialogStore`; add right after the `DropdownMenuLabel`/first `DropdownMenuSeparator`:

```tsx
                    <DropdownMenuItem onClick={() => openAccount(true)}>
                        <UserRoundIcon/>
                        Account
                    </DropdownMenuItem>
```

with `const openAccount = useAccountDialogStore((state) => state.setOpen);` next to `openNotifications`.

- [ ] **Step 2: Mount in `src/Layout.tsx`**

Import `AccountDialog` and render `<AccountDialog/>` right after `<NotificationsDialog/>` inside the same `ErrorBoundary` (keep Layout's 4-space, no-brace-space style).

- [ ] **Step 3: `src/components/account/RenamePasskeyDialog.tsx`**

A small shadcn `Dialog` (not ResponsiveDialog; it is a short form): title "Passkey hernoemen", an `Input` (autoFocus, maxLength 40, initial value = current name), buttons "Annuleren" (outline) and "Opslaan" (disabled while saving or when the trimmed value is empty). On submit (also Enter) call `onSave(trimmed)`; on error show `PASSKEY_MESSAGES[classifyPasskeyError(error)]` in a `Reveal`ed `role="alert"` line and stay open; on success close. Props: `{ open: boolean; name: string; onOpenChange(open: boolean): void; onSave(name: string): Promise<void> }`. Reset the input to `name` whenever it opens.

- [ ] **Step 4: `src/components/account/AccountDialog.tsx`**

Structure (copy exact):

- `ResponsiveDialog` with `title="Account"`, `description="Je passkeys en de apparaten waarop je bent ingelogd."`, `className="sm:max-w-2xl"`, `open` from the store, `onClose={() => setOpen(false)}`. Content scrolls (`min-h-0 flex-1 overflow-y-auto` wrapper with `flex flex-col gap-7`).
- Loading (no data yet, no error): two skeleton groups (heading bar + a `h-32` box). Error without data: muted line "Kan je account niet laden." + outline button "Opnieuw" (`refresh()`). Loading → content swaps with `AnimatePresence mode="wait"` + `SWAP`.
- **Group "Passkeys"**: heading row = `text-sm font-semibold` "Passkeys" on the left and on the right a `Button size="sm" variant="outline"` "Passkey toevoegen" (`PlusIcon`; hidden when `!passkeysSupported()`; spinner while busy). Adding: `updateUserState(await addPasskey(authHeader))`, `refresh()`, `toast.success('Passkey toegevoegd')`; failure: `toast.error(PASSKEY_MESSAGES[classifyPasskeyError(error)])` except `cancelled` (silent).
  Box rows per passkey: title = passkey name, meta = `passkeyMeta(passkey, now)`, trailing ⋯ `DropdownMenu` (ghost icon button `size="icon"` with `EllipsisIcon`, `aria-label="Opties voor {name}"`): "Hernoemen" (`PencilIcon`, opens RenamePasskeyDialog) and "Verwijderen" (`Trash2Icon`, `variant="destructive"`, disabled when it is the only passkey, with the item's text "Verwijderen" and, when disabled, a second muted line `text-xs` "Je laatste passkey kan niet weg"). Verwijderen opens `ConfirmDialog` title "Passkey verwijderen?", description "Met \"{name}\" kun je daarna niet meer inloggen.", confirmLabel "Verwijderen", destructive; onConfirm → `removePasskey(id)`, close, `toast.success('Passkey verwijderd')`; error → toast with the server message (`error.response?.data?.message`) or "Verwijderen is mislukt, probeer het opnieuw.".
  No passkeys (account made without one): a single muted row "Nog geen passkey. Voeg er een toe om sneller in te loggen."
- **Group "Ingelogd op"**: rows = `orderSessions(account.sessions)` then `account.devices`.
  - Session row: title = `session.label`, meta = `sessionMeta(session, now)`; trailing `Button size="sm" variant="ghost"` "Uitloggen". For the current session: ConfirmDialog title "Uitloggen op dit apparaat?", description "Je moet daarna opnieuw inloggen.", confirmLabel "Uitloggen" → `logout()` (from `useLogout`). For another session: ConfirmDialog title "{label} uitloggen?", description "Wie daar is ingelogd, moet opnieuw inloggen.", confirmLabel "Uitloggen", destructive → `removeSession(id)`, close, `toast.success('Uitgelogd op {label}')`.
  - Device row: title = device name, meta = `deviceMeta(device, now)`; trailing ghost button "Ontkoppelen". ConfirmDialog title "{name} ontkoppelen?", description "De app op die telefoon stopt met het delen van de locatie tot je hem opnieuw koppelt.", confirmLabel "Ontkoppelen", destructive → `removeDevice(id)`, close, `toast.success('{name} ontkoppeld')`.
  - Below the box, only when there is at least one non-current session: `Button variant="outline" size="sm"` "Alle andere browsers uitloggen" → ConfirmDialog title "Alle andere browsers uitloggen?", description "Overal behalve hier moet je opnieuw inloggen. Gekoppelde Android-telefoons blijven gekoppeld.", confirmLabel "Uitloggen", destructive → `removeOtherSessions()`, close, `toast.success(removed === 1 ? '1 browser uitgelogd' : `${removed} browsers uitgelogd`)`.
- Use one `ConfirmDialog` instance driven by a `confirm` state (`{ title, description, confirmLabel, destructive, action }` or null), so only one confirm is ever open.
- `now` from `useNow(open)` so "5 min geleden" stays fresh while the dialog is open.
- **Animations:** rows inside each box are `motion.div`s inside `<AnimatePresence initial={false}>`, keyed by id, with `initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}` and `REVEAL_TRANSITION`, `overflow-hidden` on the motion wrapper and the row padding on an inner div (so `divide-y` borders stay correct during the height animation — put the border on the inner div via `border-t` on all but the first if `divide-y` misbehaves with exiting rows). The "Alle andere browsers uitloggen" button uses `Reveal`. The row style per the Global Constraints.

- [ ] **Step 5: Verify and commit**

Run: `npx --yes bun test && npx --yes bun x tsc -b && npx --yes bun run lint && npx --yes bun x vite build --outDir /tmp/jh-acct-build` (delete the dir afterwards).

```bash
git add src/components/account src/components/Settings.tsx src/Layout.tsx
git commit -m "feat(account): Account dialog with passkeys and logged-in devices

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Smoke (controller)

Not for a subagent. Throwaway server (`PORT=3101`, `MONGO_URI=mongodb://localhost:27017/jotihunt-passkey-smoke`, `WEBAUTHN_RP_ID=localhost`, `WEBAUTHN_ORIGINS=http://localhost:5191`, `PUBLIC_APP_URL=http://localhost:5191`, external URLs → `http://127.0.0.1:9`) and the client on vite `:5191` with `API_BASE_URL=http://localhost:3101`:

- [ ] curl: `login-link --new Smoke` → herstel without passkey → `GET /account` lists one current session; `DELETE /account/sessions` → `removed: 0`.
- [ ] Headless screenshot of the dialog (playwright-core with `~/.cache/ms-playwright/chromium_headless_shell-1234`) after logging in via the herstel no-passkey flow.
- [ ] Stop both processes, drop `jotihunt-passkey-smoke`.
