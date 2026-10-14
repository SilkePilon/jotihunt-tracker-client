# Passwordless accounts, piece 2: QR login — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A laptop (or the HQ beamer) logs in by showing a QR code; a phone that is already logged in scans it and confirms with its passkey.

**Architecture:** Server: a `QrLogin` document on the auth (real-DB) connection with a hashed URL code and a hashed poll secret. The laptop creates it and polls; the phone scans (status `scanned`, a WebAuthn challenge is stored on the document), then approves with a passkey assertion. The laptop's session is created **when the laptop collects the approval** (one atomic `findOneAndDelete`), so an approval nobody collects leaves no session behind. Client: the right half of login card B shows the QR (desktop only) and polls; `/l/:code` sends the phone to the map with a confirm drawer (option C).

**Tech Stack:** Server Bun + Express 5 + Mongoose 9 + `@simplewebauthn/server` (through `src/auth/webauthn.ts`); client React 19 + react-auth-kit v3 + `@simplewebauthn/browser` + shadcn + vaul drawer. Tests: `bun test` in both repos.

Spec: `docs/superpowers/specs/2026-10-14-passwordless-accounts-design.md` (sections QrLogin, Endpoints, Routes `/login` and `/l/:code`). Mockups: `/home/silke/Documents/Jotihunt 2026/.superpowers/brainstorm/129170-1791927526/content/login-layout-v2.html` (option B) and `qr-confirm.html` (option C + the four laptop states).

## Global Constraints

- Worktrees: server `/home/silke/Documents/Jotihunt 2026/.worktrees/server-qr`, client `/home/silke/Documents/Jotihunt 2026/.worktrees/client-qr`, both on branch `feat/qr-login`. Never touch the main checkouts, the live docker stack (server :3000, client :8080) or its database.
- Run bun as `npx --yes bun ...`. Server tests: `npx --yes bun run test` (the script has `--timeout 30000`). Server checks: `npx --yes bun run typecheck` and `npx --yes bun run lint`. Client: `npx --yes bun test`, `npx --yes bun x tsc -b`, `npx --yes bun run lint`. Run `npx --yes bun install` first in a fresh worktree.
- Tests use Mongo at `mongodb://localhost:27017/jotihunt-test` (default of `src/test/db.ts`). Never use another database name.
- QR code lifetime: **2 minutes** (`QR_TTL_MS = 2 * 60 * 1000`), extended to 2 minutes from the scan when scanned. The login page renews codes by itself for **10 minutes**, then shows `Nieuwe code`. Laptop polls every **1.5 s**.
- QR URL: `${PUBLIC_APP_URL}/l/<code>`. Code: 18 random bytes base64url. Poll secret: 32 random bytes base64url. Both stored only as SHA-256 hex (`sha256` from `src/auth/hash.ts`).
- The poll secret travels in the `X-Qr-Secret` request header (never in the URL: 4xx request URLs are logged). Add `x-qr-secret` to the request logger's `headerBlacklist`.
- Approving needs a passkey assertion with **one of the scanning user's own passkeys** against the challenge stored on that QR login, `userVerification: "required"`.
- Phone endpoints need a **web session** (`verifyToken` + `requireWebSession`); a paired Android device token gets 403.
- All user-facing copy is Dutch, exactly as written in this plan. Never show raw error names.
- Code style: match the surrounding files (2-space indent in `src/auth`, server double quotes; client single quotes, 2-space in new files). Comments only where they explain a why, like the existing auth files.
- Commit after each task with a conventional message ending in the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Deviations from the spec (agreed in planning)

- Scan is `POST /auth/qr/scan/:code` (not GET): it changes state.
- Poll is `GET /auth/qr/:id` with header `X-Qr-Secret` (not `?secret=`).
- The QrLogin document stores no token: the session is created at collection time.
- Location = Cloudflare visitor headers (`cf-ipcity`, else the Dutch country name from `cf-ipcountry`), else omitted.

## File map

Server (`.worktrees/server-qr`):
- `src/auth/models.ts` — add `QrLoginDoc` + `qrLogins()`.
- `src/auth/qr-login.ts` (new) — create / poll / scan / approve / deny on the document; no HTTP.
- `src/auth/qr-login.test.ts` (new) — unit tests against the test DB.
- `src/auth/location.ts` + `src/auth/location.test.ts` (new) — `approxLocation`.
- `src/auth/qr.controller.ts` (new) — HTTP handlers, WebAuthn calls.
- `src/routes/auth.route.ts` — QR routes + limiters.
- `src/app.ts` — `x-qr-secret` in `headerBlacklist`.
- `src/auth/qr-flows.test.ts` (new) — HTTP tests with the fake WebAuthn module.
- `docs/superpowers/specs/...` lives in the client repo; the spec amendment is in Task 3.

Client (`.worktrees/client-qr`):
- `src/lib/auth-api.ts` — QR API calls.
- `src/lib/qr-login.ts` + `src/lib/qr-login.test.ts` (new) — pure helpers: next path after login, poll → panel state, phone error → message.
- `src/hooks/qr-login.hook.ts` (new) — laptop: create, poll, renew.
- `src/components/auth/QrLoginPanel.tsx` (new) — right half of login B.
- `src/pages/Login.tsx` — layout B with the panel, `?next=`.
- `src/pages/QrLink.tsx` (new) + `src/Routes.tsx` — `/l/:code`.
- `src/components/auth/QrConfirmDrawer.tsx` (new) + `src/Layout.tsx` — phone confirm drawer.

---

### Task 1: Server — QrLogin model, service and location

**Files:**
- Modify: `src/auth/models.ts`
- Create: `src/auth/qr-login.ts`, `src/auth/qr-login.test.ts`, `src/auth/location.ts`, `src/auth/location.test.ts`

**Interfaces:**
- Consumes: `sha256(value): string` (`src/auth/hash.ts`), `publicAppUrl(): string` (`src/auth/config.ts`), `isObjectIdString(value): boolean` (`src/utils/mongo.ts`), `authModel` (`src/auth/auth-db.ts`).
- Produces (used by Task 2):
  - `QR_TTL_MS: number`
  - `createQrLogin(requester: { label: string; location: string | null }, now?: Date): Promise<{ id: string; code: string; pollSecret: string; url: string; expiresAt: Date }>`
  - `pollQrLogin(id: string, pollSecret: string, now?: Date): Promise<QrPoll | null>` where `QrPoll = { status: "waiting" | "denied" | "expired"; expiresAt: Date } | { status: "scanned"; scannedBy: { name: string }; expiresAt: Date } | { status: "approved"; userId: Types.ObjectId; label: string }`. `"approved"` is returned once (the document is deleted).
  - `scanQrLogin(code: string, user: { _id: Types.ObjectId; name: string }, challenge: string, now?: Date): Promise<{ ok: true; requester: { label: string; location: string | null }; createdAt: Date } | { ok: false; reason: "gone" | "taken" }>`
  - `findScannedQrLogin(code: string, userId: Types.ObjectId, now?: Date): Promise<QrLoginDoc | null>`
  - `approveQrLogin(code: string, userId: Types.ObjectId, challenge: string, now?: Date): Promise<boolean>`
  - `denyQrLogin(code: string, userId: Types.ObjectId, now?: Date): Promise<boolean>`
  - `approxLocation(header: (name: string) => string | undefined): string | null`

- [ ] **Step 1: Add the model to `src/auth/models.ts`**

Insert before the `export const sessions = ...` lines:

```ts
export const QR_LOGIN_STATUSES = ["waiting", "scanned", "approved", "denied"] as const;
export type QrLoginStatus = (typeof QR_LOGIN_STATUSES)[number];

/** A laptop waiting to be logged in by a phone that scans its QR code. Code and poll secret are stored hashed. */
export interface QrLoginDoc {
  _id: Types.ObjectId;
  codeHash: string;
  /** Only the laptop knows the poll secret: whoever scans the code can not collect the session */
  pollSecretHash: string;
  status: QrLoginStatus;
  requester: { label: string; location: string | null };
  scannedBy: Types.ObjectId | null;
  scannedByName: string | null;
  /** WebAuthn challenge for the scanning phone's passkey */
  challenge: string | null;
  createdAt: Date;
  expiresAt: Date;
}

const QrLoginSchema = new mongoose.Schema<QrLoginDoc>(
  {
    codeHash: { type: String, required: true, unique: true },
    pollSecretHash: { type: String, required: true },
    status: { type: String, enum: QR_LOGIN_STATUSES, required: true },
    requester: {
      label: { type: String, required: true },
      location: { type: String, default: null },
    },
    scannedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    scannedByName: { type: String, default: null },
    challenge: { type: String, default: null },
    createdAt: { type: Date, required: true },
    // Kept 10 minutes after expiry so the laptop's poll can still say "expired", then removed by MongoDB
    expiresAt: { type: Date, required: true, index: { expires: 10 * 60 } },
  },
  { versionKey: false },
);
```

and add next to the other model accessors:

```ts
export const qrLogins = () => authModel<QrLoginDoc>("QrLogin", QrLoginSchema);
```

- [ ] **Step 2: Write the failing service tests `src/auth/qr-login.test.ts`**

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import mongoose from "mongoose";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../test/db";
import { qrLogins } from "./models";
import { approveQrLogin, createQrLogin, denyQrLogin, findScannedQrLogin, pollQrLogin, QR_TTL_MS, scanQrLogin } from "./qr-login";

process.env.PUBLIC_APP_URL = "https://jotihunt.test";
// Compile the model before connectTestDb syncs the indexes
qrLogins();

beforeAll(connectTestDb);
beforeEach(clearTestDb);
afterAll(disconnectTestDb);

const requester = { label: "Firefox op Linux", location: "Arnhem" };
const jesse = { _id: new mongoose.Types.ObjectId(), name: "Jesse" };
const noor = { _id: new mongoose.Types.ObjectId(), name: "Noor" };
const t0 = new Date("2026-10-17T12:00:00Z");
const at = (ms: number) => new Date(t0.getTime() + ms);

describe("QR login", () => {
  test("create: a link with the code; code and poll secret are only stored hashed", async () => {
    const qr = await createQrLogin(requester, t0);
    expect(qr.url).toBe(`https://jotihunt.test/l/${qr.code}`);
    expect(qr.expiresAt).toEqual(at(QR_TTL_MS));
    const stored = JSON.stringify(await qrLogins().findById(qr.id).lean());
    expect(stored).not.toContain(qr.code);
    expect(stored).not.toContain(qr.pollSecret);
    expect(await pollQrLogin(qr.id, qr.pollSecret, at(1000))).toEqual({ status: "waiting", expiresAt: at(QR_TTL_MS) });
  });

  test("poll with a wrong secret or a malformed id is null", async () => {
    const qr = await createQrLogin(requester, t0);
    expect(await pollQrLogin(qr.id, "wrong", at(1000))).toBeNull();
    expect(await pollQrLogin("nope", qr.pollSecret, at(1000))).toBeNull();
  });

  test("scan: scanned with the name and a fresh 2 minutes; the same user may scan again, another user gets taken", async () => {
    const qr = await createQrLogin(requester, t0);
    const scan = await scanQrLogin(qr.code, jesse, "challenge-1", at(60_000));
    expect(scan).toEqual({ ok: true, requester, createdAt: t0 });
    expect(await pollQrLogin(qr.id, qr.pollSecret, at(61_000))).toEqual({ status: "scanned", scannedBy: { name: "Jesse" }, expiresAt: at(60_000 + QR_TTL_MS) });
    expect((await scanQrLogin(qr.code, jesse, "challenge-2", at(62_000))).ok).toBe(true);
    expect((await findScannedQrLogin(qr.code, jesse._id, at(62_000)))!.challenge).toBe("challenge-2");
    expect(await scanQrLogin(qr.code, noor, "challenge-3", at(63_000))).toEqual({ ok: false, reason: "taken" });
    expect(await scanQrLogin("unknown-code", jesse, "challenge-4", at(63_000))).toEqual({ ok: false, reason: "gone" });
  });

  test("expired codes can not be scanned and poll says expired", async () => {
    const qr = await createQrLogin(requester, t0);
    expect(await scanQrLogin(qr.code, jesse, "challenge-1", at(QR_TTL_MS))).toEqual({ ok: false, reason: "gone" });
    expect(await pollQrLogin(qr.id, qr.pollSecret, at(QR_TTL_MS))).toEqual({ status: "expired", expiresAt: at(QR_TTL_MS) });
  });

  test("approve needs the scanning user and the current challenge; poll hands the approval over once", async () => {
    const qr = await createQrLogin(requester, t0);
    await scanQrLogin(qr.code, jesse, "challenge-1", at(1000));
    expect(await approveQrLogin(qr.code, noor._id, "challenge-1", at(2000))).toBe(false);
    expect(await approveQrLogin(qr.code, jesse._id, "old-challenge", at(2000))).toBe(false);
    expect(await approveQrLogin(qr.code, jesse._id, "challenge-1", at(2000))).toBe(true);
    expect(await approveQrLogin(qr.code, jesse._id, "challenge-1", at(2000))).toBe(false);
    expect(await findScannedQrLogin(qr.code, jesse._id, at(2000))).toBeNull();
    expect(await pollQrLogin(qr.id, "wrong", at(3000))).toBeNull();
    expect(await pollQrLogin(qr.id, qr.pollSecret, at(3000))).toEqual({ status: "approved", userId: jesse._id, label: "Firefox op Linux" });
    expect(await pollQrLogin(qr.id, qr.pollSecret, at(4000))).toBeNull();
  });

  test("deny: only the scanning user, then poll says denied", async () => {
    const qr = await createQrLogin(requester, t0);
    expect(await denyQrLogin(qr.code, jesse._id, at(1000))).toBe(false);
    await scanQrLogin(qr.code, jesse, "challenge-1", at(1000));
    expect(await denyQrLogin(qr.code, noor._id, at(2000))).toBe(false);
    expect(await denyQrLogin(qr.code, jesse._id, at(2000))).toBe(true);
    expect((await pollQrLogin(qr.id, qr.pollSecret, at(3000)))!.status).toBe("denied");
    expect(await approveQrLogin(qr.code, jesse._id, "challenge-1", at(3000))).toBe(false);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx --yes bun test src/auth/qr-login.test.ts`
Expected: FAIL, `Cannot find module './qr-login'`.

- [ ] **Step 4: Implement `src/auth/qr-login.ts`**

```ts
import { randomBytes } from "node:crypto";
import type { Types } from "mongoose";
import { isObjectIdString } from "../utils/mongo";
import { publicAppUrl } from "./config";
import { sha256 } from "./hash";
import { qrLogins, type QrLoginDoc } from "./models";

export const QR_TTL_MS = 2 * 60 * 1000;

export type QrPoll =
  | { status: "waiting" | "denied" | "expired"; expiresAt: Date }
  | { status: "scanned"; scannedBy: { name: string }; expiresAt: Date }
  | { status: "approved"; userId: Types.ObjectId; label: string };

export async function createQrLogin(requester: { label: string; location: string | null }, now = new Date()) {
  const code = randomBytes(18).toString("base64url");
  const pollSecret = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + QR_TTL_MS);
  const doc = await qrLogins().create({ codeHash: sha256(code), pollSecretHash: sha256(pollSecret), status: "waiting", requester, createdAt: now, expiresAt });
  return { id: String(doc._id), code, pollSecret, url: `${publicAppUrl()}/l/${code}`, expiresAt };
}

/** The laptop's view; null for an unknown id or wrong secret. An approval is handed over once (the document is deleted). */
export async function pollQrLogin(id: string, pollSecret: string, now = new Date()): Promise<QrPoll | null> {
  if (!isObjectIdString(id)) return null;
  const filter = { _id: id, pollSecretHash: sha256(pollSecret) };
  const doc = await qrLogins().findOne(filter).lean<QrLoginDoc>();
  if (!doc) return null;
  if (doc.status === "approved") {
    const taken = await qrLogins().findOneAndDelete({ ...filter, status: "approved" }).lean<QrLoginDoc>();
    return taken?.scannedBy ? { status: "approved", userId: taken.scannedBy, label: taken.requester.label } : null;
  }
  if (doc.status === "denied") return { status: "denied", expiresAt: doc.expiresAt };
  if (doc.expiresAt.getTime() <= now.getTime()) return { status: "expired", expiresAt: doc.expiresAt };
  if (doc.status === "scanned") return { status: "scanned", scannedBy: { name: doc.scannedByName ?? "" }, expiresAt: doc.expiresAt };
  return { status: "waiting", expiresAt: doc.expiresAt };
}

/**
 * The phone scanned the code: store its passkey challenge and give it 2 fresh minutes. The same user may scan again
 * (a reload replaces the challenge); "taken" when another user already scanned it.
 */
export async function scanQrLogin(code: string, user: { _id: Types.ObjectId; name: string }, challenge: string, now = new Date()) {
  const codeHash = sha256(code);
  const live = { codeHash, expiresAt: { $gt: now } };
  const doc = await qrLogins()
    .findOneAndUpdate(
      { ...live, $or: [{ status: "waiting" }, { status: "scanned", scannedBy: user._id }] },
      { $set: { status: "scanned", scannedBy: user._id, scannedByName: user.name, challenge, expiresAt: new Date(now.getTime() + QR_TTL_MS) } },
      { returnDocument: "after" },
    )
    .lean<QrLoginDoc>();
  if (doc) return { ok: true as const, requester: { label: doc.requester.label, location: doc.requester.location ?? null }, createdAt: doc.createdAt };
  const taken = await qrLogins().exists({ ...live, status: "scanned" });
  return { ok: false as const, reason: taken ? ("taken" as const) : ("gone" as const) };
}

export function findScannedQrLogin(code: string, userId: Types.ObjectId, now = new Date()) {
  return qrLogins().findOne({ codeHash: sha256(code), status: "scanned", scannedBy: userId, expiresAt: { $gt: now } }).lean<QrLoginDoc>();
}

/** After the passkey checked out: atomically, so one challenge approves once. */
export async function approveQrLogin(code: string, userId: Types.ObjectId, challenge: string, now = new Date()): Promise<boolean> {
  const doc = await qrLogins().findOneAndUpdate(
    { codeHash: sha256(code), status: "scanned", scannedBy: userId, challenge, expiresAt: { $gt: now } },
    { $set: { status: "approved", challenge: null } },
  );
  return doc !== null;
}

export async function denyQrLogin(code: string, userId: Types.ObjectId, now = new Date()): Promise<boolean> {
  const doc = await qrLogins().findOneAndUpdate(
    { codeHash: sha256(code), status: "scanned", scannedBy: userId, expiresAt: { $gt: now } },
    { $set: { status: "denied", challenge: null } },
  );
  return doc !== null;
}
```

- [ ] **Step 5: Run the service tests**

Run: `npx --yes bun test src/auth/qr-login.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Write the failing location test `src/auth/location.test.ts`**

```ts
import { describe, expect, test } from "bun:test";
import { approxLocation } from "./location";

const headers = (values: Record<string, string>) => (name: string) => values[name];

describe("approxLocation", () => {
  test("city first, else the Dutch country name, else null", () => {
    expect(approxLocation(headers({ "cf-ipcity": "Arnhem", "cf-ipcountry": "NL" }))).toBe("Arnhem");
    expect(approxLocation(headers({ "cf-ipcountry": "NL" }))).toBe("Nederland");
    expect(approxLocation(headers({ "cf-ipcountry": "be" }))).toBe("België");
    expect(approxLocation(headers({}))).toBeNull();
  });

  test("Cloudflare's unknown (XX) and Tor (T1) codes and junk are null", () => {
    expect(approxLocation(headers({ "cf-ipcountry": "XX" }))).toBeNull();
    expect(approxLocation(headers({ "cf-ipcountry": "T1" }))).toBeNull();
    expect(approxLocation(headers({ "cf-ipcountry": "Nederland" }))).toBeNull();
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx --yes bun test src/auth/location.test.ts`
Expected: FAIL, `Cannot find module './location'`.

- [ ] **Step 8: Implement `src/auth/location.ts`**

```ts
const regions = new Intl.DisplayNames(["nl"], { type: "region" });

/**
 * Rough location of a request from Cloudflare's visitor headers, for the QR confirm screen: "Arnhem", else
 * "Nederland"; null without Cloudflare (local runs) or for unknown/Tor addresses.
 */
export function approxLocation(header: (name: string) => string | undefined): string | null {
  const city = header("cf-ipcity")?.trim();
  if (city) return city.slice(0, 60);
  const country = header("cf-ipcountry")?.trim().toUpperCase();
  if (!country || !/^[A-Z]{2}$/.test(country) || country === "XX") return null;
  try {
    return regions.of(country) ?? null;
  } catch {
    return null;
  }
}
```

(`T1` fails the `^[A-Z]{2}$` test because of the digit.)

- [ ] **Step 9: Run both test files, typecheck and lint**

Run: `npx --yes bun test src/auth/qr-login.test.ts src/auth/location.test.ts && npx --yes bun run typecheck && npx --yes bun run lint`
Expected: all pass, no type or lint errors.

- [ ] **Step 10: Commit**

```bash
git add src/auth/models.ts src/auth/qr-login.ts src/auth/qr-login.test.ts src/auth/location.ts src/auth/location.test.ts
git commit -m "feat(auth): QR login documents (create, poll, scan, approve, deny) and approximate location

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Server — QR endpoints

**Files:**
- Create: `src/auth/qr.controller.ts`, `src/auth/qr-flows.test.ts`
- Modify: `src/routes/auth.route.ts`, `src/app.ts` (`headerBlacklist`)

**Interfaces:**
- Consumes: everything Task 1 produces; `createSession(userId, { label, via }) => Promise<{ token, sessionId }>` (`src/auth/sessions.ts`); `publicUser(user)` (`src/auth/public-user.ts`); `deviceLabel(ua)` (`src/auth/user-agent.ts`); `updateAccounts(filter, update)` (`src/auth/user-store.ts`); `authenticationOptions(allow)`, `verifyAuthentication(response, challenge, passkey)` (`src/auth/webauthn.ts`); `PASSKEY_FAILED` (`src/auth/session-response.ts`); `verifyToken`, `requireWebSession` (`src/middleware/auth.middleware.ts`); `limitRate`, `limitFailures` (`src/middleware/rate-limit.ts`).
- Produces (HTTP contract used by Tasks 3–5):
  - `POST /auth/qr` → 201 `{ id, code, pollSecret, url, expiresAt }` (ISO string).
  - `GET /auth/qr/:id` with header `X-Qr-Secret` → 200 `{ status: "waiting" | "denied" | "expired", expiresAt }` | `{ status: "scanned", scannedBy: { name }, expiresAt }` | `{ status: "approved", token, user }`; 404 `{ message, code: "QR_GONE" }` for unknown/wrong secret/already collected.
  - `POST /auth/qr/scan/:code` (web session) → 200 `{ requester: { label, location }, createdAt, options }`; 409 `{ code: "NO_PASSKEY" }` (user has no passkeys, nothing changes); 409 `{ code: "QR_TAKEN" }`; 404 `{ code: "QR_GONE" }`; 403 for device tokens.
  - `POST /auth/qr/scan/:code/approve` body `{ response }` → 204; 401 `{ code: "PASSKEY_FAILED" }` (not the user's passkey or a bad assertion; the challenge stays valid so the user can retry); 404 `QR_GONE`.
  - `POST /auth/qr/scan/:code/deny` → 204; 404 `QR_GONE`.

- [ ] **Step 1: Write the failing HTTP tests `src/auth/qr-flows.test.ts`**

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

const LAPTOP_UA = "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0";
function request(path: string, init: RequestInit & { token?: string; json?: unknown; secret?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  if (init.secret !== undefined) headers.set("X-Qr-Secret", init.secret);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  headers.set("User-Agent", LAPTOP_UA);
  return fetch(`${base}${path}`, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
}
const json = async <T = Record<string, unknown>>(res: Response) => (await res.json()) as T;
const passkey = (id: string) => ({ credentialId: id, publicKey: Buffer.from(`pk-${id}`), counter: 0, transports: ["internal"], name: "Test" });
type Qr = { id: string; code: string; pollSecret: string; url: string; expiresAt: string };

async function startQr(headers: Record<string, string> = {}) {
  const res = await request("/auth/qr", { method: "POST", headers });
  expect(res.status).toBe(201);
  return json<Qr>(res);
}
const poll = (qr: Qr, secret = qr.pollSecret) => request(`/auth/qr/${qr.id}`, { secret });
const scan = (qr: Qr, token: string) => request(`/auth/qr/scan/${qr.code}`, { method: "POST", token });
const approve = (qr: Qr, token: string, id = "cred-1", signature = "valid") =>
  request(`/auth/qr/scan/${qr.code}/approve`, { method: "POST", token, json: { response: { id, response: { signature } } } });

describe("QR login", () => {
  test("laptop shows a code, phone scans and approves with its passkey, laptop gets a session once", async () => {
    const jesse = await withSession(await createAccount({ name: "Jesse", passkey: passkey("cred-1") }));
    const qr = await startQr({ "cf-ipcity": "Arnhem" });
    expect(qr.url).toBe(`https://jotihunt.test/l/${qr.code}`);
    expect((await json(await poll(qr))).status).toBe("waiting");

    const scanned = await scan(qr, tokenFor(jesse));
    expect(scanned.status).toBe(200);
    const body = await json<{ requester: unknown; options: { allowCredentials: { id: string }[] } }>(scanned);
    expect(body.requester).toEqual({ label: "Firefox op Linux", location: "Arnhem" });
    expect(body.options.allowCredentials.map((entry) => entry.id)).toEqual(["cred-1"]);
    expect(await json(await poll(qr))).toMatchObject({ status: "scanned", scannedBy: { name: "Jesse" } });

    expect((await approve(qr, tokenFor(jesse))).status).toBe(204);
    const done = await poll(qr);
    expect(done.status).toBe(200);
    const result = await json<{ status: string; token: string; user: { name: string } }>(done);
    expect(result.status).toBe("approved");
    expect(result.user.name).toBe("Jesse");
    expect((await request("/auth/me", { token: result.token })).status).toBe(200);
    const laptopSession = await sessions().findOne({ via: "qr" }).lean();
    expect(laptopSession).toMatchObject({ label: "Firefox op Linux" });
    expect((await User.findById(jesse._id))!.passkeys[0].counter).toBe(1);
    expect((await poll(qr)).status).toBe(404);
  });

  test("a wrong poll secret is a 404 and never hands over the session", async () => {
    const jesse = await withSession(await createAccount({ name: "Jesse", passkey: passkey("cred-1") }));
    const qr = await startQr();
    await scan(qr, tokenFor(jesse));
    await approve(qr, tokenFor(jesse));
    const wrong = await poll(qr, "guess");
    expect(wrong.status).toBe(404);
    expect((await json(wrong)).code).toBe("QR_GONE");
    expect((await json(await poll(qr))).status).toBe("approved");
  });

  test("a bad assertion or another user's passkey is 401 and can be retried; a second scanner gets QR_TAKEN", async () => {
    const jesse = await withSession(await createAccount({ name: "Jesse", passkey: passkey("cred-1") }));
    const noor = await withSession(await createAccount({ name: "Noor", passkey: passkey("cred-2") }));
    const qr = await startQr();
    await scan(qr, tokenFor(jesse));
    const taken = await scan(qr, tokenFor(noor));
    expect(taken.status).toBe(409);
    expect((await json(taken)).code).toBe("QR_TAKEN");
    const forged = await approve(qr, tokenFor(jesse), "cred-1", "forged");
    expect(forged.status).toBe(401);
    expect((await json(forged)).code).toBe("PASSKEY_FAILED");
    expect((await approve(qr, tokenFor(jesse), "cred-2")).status).toBe(401);
    expect((await approve(qr, tokenFor(noor), "cred-2")).status).toBe(404);
    expect((await approve(qr, tokenFor(jesse))).status).toBe(204);
  });

  test("deny: the laptop sees denied and approving afterwards is QR_GONE", async () => {
    const jesse = await withSession(await createAccount({ name: "Jesse", passkey: passkey("cred-1") }));
    const qr = await startQr();
    await scan(qr, tokenFor(jesse));
    expect((await request(`/auth/qr/scan/${qr.code}/deny`, { method: "POST", token: tokenFor(jesse) })).status).toBe(204);
    expect((await json(await poll(qr))).status).toBe("denied");
    expect((await approve(qr, tokenFor(jesse))).status).toBe(404);
  });

  test("users without a passkey get NO_PASSKEY and the code stays waiting; unknown codes are QR_GONE", async () => {
    const noPasskey = await withSession(await User.create({ name: "Tim" }));
    const qr = await startQr();
    const res = await scan(qr, tokenFor(noPasskey));
    expect(res.status).toBe(409);
    expect((await json(res)).code).toBe("NO_PASSKEY");
    expect((await json(await poll(qr))).status).toBe("waiting");
    const jesse = await withSession(await createAccount({ name: "Jesse", passkey: passkey("cred-1") }));
    const unknown = await request("/auth/qr/scan/does-not-exist", { method: "POST", token: tokenFor(jesse) });
    expect(unknown.status).toBe(404);
    expect((await json(unknown)).code).toBe("QR_GONE");
  });

  test("phone endpoints need a web session: no token 401, a paired phone's device token 403", async () => {
    const jesse = await createAccount({ name: "Jesse", passkey: passkey("cred-1") });
    await User.updateOne({ _id: jesse._id }, { $push: { devices: { id: "phone-1", name: "Pixel", createdAt: new Date() } } });
    const qr = await startQr();
    expect((await request(`/auth/qr/scan/${qr.code}`, { method: "POST" })).status).toBe(401);
    expect((await scan(qr, signDeviceToken(jesse, "phone-1"))).status).toBe(403);
  });
});
```

Before writing the device-token test, open `src/auth/auth-flows.test.ts` ("a paired phone (device token) can not add a passkey: 403") and copy exactly how it pushes the device and calls `signDeviceToken`; if the signature or device fields differ from the lines above, use the ones from that test.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx --yes bun test src/auth/qr-flows.test.ts`
Expected: FAIL (`POST /auth/qr` answers 404).

- [ ] **Step 3: Implement `src/auth/qr.controller.ts`**

```ts
import type { Request, Response } from "express";
import { User } from "../models/user.model";
import { approxLocation } from "./location";
import { publicUser } from "./public-user";
import { approveQrLogin, createQrLogin, denyQrLogin, findScannedQrLogin, pollQrLogin, scanQrLogin } from "./qr-login";
import { PASSKEY_FAILED } from "./session-response";
import { createSession } from "./sessions";
import { deviceLabel } from "./user-agent";
import { updateAccounts } from "./user-store";
import { authenticationOptions, verifyAuthentication, type StoredPasskey } from "./webauthn";

const QR_GONE = { message: "Deze code werkt niet meer. Vernieuw de code op het andere apparaat.", code: "QR_GONE" };
const QR_TAKEN = { message: "Iemand anders heeft deze code al gescand.", code: "QR_TAKEN" };
const NO_PASSKEY = { message: "Voeg eerst een passkey toe aan je account.", code: "NO_PASSKEY" };

type UserPasskey = NonNullable<Request["user"]>["passkeys"][number];
const stored = (passkey: UserPasskey): StoredPasskey => ({
  credentialId: passkey.credentialId,
  publicKey: Buffer.from(passkey.publicKey),
  counter: passkey.counter,
  transports: [...passkey.transports],
});

/** Laptop: a new code to show as QR. */
export async function start(req: Request, res: Response) {
  const qr = await createQrLogin({ label: deviceLabel(req.get("user-agent")), location: approxLocation((name) => req.get(name)) });
  return res.status(201).json(qr);
}

/** Laptop: what happened to the code; after approval the session, exactly once. */
export async function poll(req: Request, res: Response) {
  const result = await pollQrLogin(String(req.params.id), req.get("x-qr-secret") ?? "");
  if (!result) return res.status(404).json(QR_GONE);
  if (result.status !== "approved") return res.status(200).json(result);
  const user = await User.findById(result.userId);
  if (!user) return res.status(404).json(QR_GONE);
  const { token } = await createSession(user._id, { label: result.label, via: "qr" });
  return res.status(200).json({ status: "approved", token, user: publicUser(user) });
}

/** Phone: claim the code and get the passkey options to confirm with. */
export async function scan(req: Request, res: Response) {
  const user = req.user!;
  if (user.passkeys.length === 0) return res.status(409).json(NO_PASSKEY);
  const options = await authenticationOptions(user.passkeys.map(stored));
  const result = await scanQrLogin(String(req.params.code), { _id: user._id, name: user.name }, options.challenge);
  if (!result.ok) return result.reason === "taken" ? res.status(409).json(QR_TAKEN) : res.status(404).json(QR_GONE);
  return res.status(200).json({ requester: result.requester, createdAt: result.createdAt, options });
}

/** Phone: the passkey assertion must come from one of the scanning user's own passkeys. */
export async function approve(req: Request, res: Response) {
  const user = req.user!;
  const code = String(req.params.code);
  const qr = await findScannedQrLogin(code, user._id);
  if (!qr?.challenge) return res.status(404).json(QR_GONE);
  const response = req.body.response as { id?: unknown };
  const passkey = user.passkeys.find((entry) => entry.credentialId === response.id);
  if (!passkey) return res.status(401).json(PASSKEY_FAILED);
  const verified = await verifyAuthentication(response, qr.challenge, stored(passkey));
  if (!verified) return res.status(401).json(PASSKEY_FAILED);
  if (!(await approveQrLogin(code, user._id, qr.challenge))) return res.status(404).json(QR_GONE);
  const now = new Date();
  await updateAccounts(
    { _id: user._id, "passkeys.credentialId": passkey.credentialId },
    { $set: { "passkeys.$.counter": verified.newCounter, "passkeys.$.lastUsedAt": now, lastActiveAt: now } },
  );
  return res.status(204).end();
}

export async function deny(req: Request, res: Response) {
  const denied = await denyQrLogin(String(req.params.code), req.user!._id);
  return denied ? res.status(204).end() : res.status(404).json(QR_GONE);
}
```

If `NonNullable<Request["user"]>["passkeys"][number]` does not typecheck (check how `src/types` declares `req.user`), type the helper's parameter as `{ credentialId: string; publicKey: Buffer | Uint8Array; counter: number; transports: string[] }`, the shape `login.controller.ts` reads.

- [ ] **Step 4: Add the routes to `src/routes/auth.route.ts`**

Add the import next to the other controllers:

```ts
import * as qrController from "../auth/qr.controller";
```

change the middleware import to

```ts
import verifyToken, { requireWebSession } from "../middleware/auth.middleware";
```

add these limiters after `optionsLimiter`:

```ts
// A login page makes a code every 2 minutes for 10 minutes; polling is every 1.5 s (600 per 15 minutes)
const qrStartLimiter = limitRate({ windowMs: 15 * 60 * 1000, max: 60, key: (req) => String(req.ip) });
const qrPollLimiter = limitRate({ windowMs: 15 * 60 * 1000, max: 1500, key: (req) => String(req.ip) });
// Guessing codes from a logged-in phone: 30 unknown codes per address per 15 minutes
const qrScanLimiter = limitFailures({
  windowMs: 15 * 60 * 1000,
  maxFailures: 30,
  failureStatus: 404,
  resetOnSuccess: false,
  key: (req) => String(req.ip),
});
```

and these routes after `router.post("/logout", ...)`:

```ts
// QR login: the laptop shows a code and polls, a logged-in phone scans it and confirms with its passkey
router.post("/qr", qrStartLimiter, qrController.start);
router.get("/qr/:id", qrPollLimiter, qrController.poll);
router.post("/qr/scan/:code", [verifyToken, requireWebSession, qrScanLimiter], qrController.scan);
router.post(
  "/qr/scan/:code/approve",
  [verifyToken, requireWebSession, passkeyLimiter, validate([body("response").isObject().withMessage("response ontbreekt.")])],
  qrController.approve,
);
router.post("/qr/scan/:code/deny", [verifyToken, requireWebSession], qrController.deny);
```

- [ ] **Step 5: Keep the poll secret out of the logs (`src/app.ts`)**

Change `headerBlacklist: ["authorization", "cookie"],` to

```ts
    headerBlacklist: ["authorization", "cookie", "x-qr-secret"],
```

and extend the comment above it: `// Never write credentials (user JWTs, cookies, QR poll secrets) from request headers to the logs.`

- [ ] **Step 6: Run the QR tests, then the full suite, typecheck and lint**

Run: `npx --yes bun test src/auth/qr-flows.test.ts`
Expected: PASS (6 tests).

Run: `npx --yes bun run test && npx --yes bun run typecheck && npx --yes bun run lint`
Expected: all tests pass (844 before this piece + the new ones), no type or lint errors.

- [ ] **Step 7: Commit**

```bash
git add src/auth/qr.controller.ts src/auth/qr-flows.test.ts src/routes/auth.route.ts src/app.ts
git commit -m "feat(auth): QR login endpoints (laptop start/poll, phone scan/approve/deny with passkey)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Client — QR API calls, pure helpers and spec amendment

**Files:**
- Modify: `src/lib/auth-api.ts`, `docs/superpowers/specs/2026-10-14-passwordless-accounts-design.md`
- Create: `src/lib/qr-login.ts`, `src/lib/qr-login.test.ts`

**Interfaces:**
- Consumes: the HTTP contract of Task 2; `classifyPasskeyError`, `PASSKEY_MESSAGES` (`src/lib/passkey.ts`); `SessionResult` (`src/lib/auth-api.ts`).
- Produces (used by Tasks 4–5):
  - `src/lib/auth-api.ts`: `interface QrStart { id: string; code: string; pollSecret: string; url: string; expiresAt: string }`; `type QrPoll = { status: 'waiting' | 'denied' | 'expired'; expiresAt: string } | { status: 'scanned'; scannedBy: { name: string }; expiresAt: string } | ({ status: 'approved' } & SessionResult)`; `interface QrScan { requester: { label: string; location: string | null }; createdAt: string; options: LoginOptions['options'] }`; `startQrLogin(): Promise<QrStart>`; `pollQrLogin(id: string, secret: string): Promise<QrPoll | 'gone'>` (404 → `'gone'`, network errors throw); `scanQrLogin(code: string, authHeader: string): Promise<QrScan>`; `approveQrLogin(code: string, scan: QrScan, authHeader: string): Promise<void>` (runs the passkey prompt); `denyQrLogin(code: string, authHeader: string): Promise<void>`.
  - `src/lib/qr-login.ts`: `QR_POLL_MS = 1500`; `QR_RENEW_FOR_MS = 600000`; `type QrPanelState`; `panelAfterPoll(poll, url, renewingSince, now): QrPanelState | 'renew'`; `nextAfterLogin(next: string | null): string`; `type QrProblem = { message: string; addPasskey: boolean }`; `qrProblem(error: unknown): QrProblem`.

- [ ] **Step 1: Write the failing tests `src/lib/qr-login.test.ts`**

```ts
import { describe, expect, test } from 'bun:test';
import { AxiosError, AxiosHeaders } from 'axios';
import { nextAfterLogin, panelAfterPoll, qrProblem, QR_RENEW_FOR_MS } from './qr-login';

function httpError(status: number, data: unknown = {}) {
  const error = new AxiosError('fail');
  error.response = { status, data, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } };
  return error;
}

const url = 'https://jotihunt.test/l/abc';
const expiresAt = '2026-10-17T12:02:00.000Z';

describe('panelAfterPoll', () => {
  test('waiting and scanned keep showing the code', () => {
    expect(panelAfterPoll({ status: 'waiting', expiresAt }, url, 0, 1000)).toEqual({ phase: 'waiting', url, expiresAt: Date.parse(expiresAt) });
    expect(panelAfterPoll({ status: 'scanned', scannedBy: { name: 'Jesse' }, expiresAt }, url, 0, 1000)).toEqual({ phase: 'scanned', url, name: 'Jesse' });
  });

  test('expired, denied or gone: a new code within 10 minutes, after that wait for a click', () => {
    expect(panelAfterPoll({ status: 'expired', expiresAt }, url, 0, QR_RENEW_FOR_MS - 1)).toBe('renew');
    expect(panelAfterPoll({ status: 'denied', expiresAt }, url, 0, 1000)).toBe('renew');
    expect(panelAfterPoll('gone', url, 0, 1000)).toBe('renew');
    expect(panelAfterPoll({ status: 'expired', expiresAt }, url, 0, QR_RENEW_FOR_MS)).toEqual({ phase: 'expired' });
  });
});

describe('nextAfterLogin', () => {
  test('only back to a QR confirm link, never anywhere else', () => {
    expect(nextAfterLogin('/l/abc_DEF-123')).toBe('/l/abc_DEF-123');
    expect(nextAfterLogin(null)).toBe('/');
    expect(nextAfterLogin('https://evil.example/l/abc')).toBe('/');
    expect(nextAfterLogin('//evil.example')).toBe('/');
    expect(nextAfterLogin('/l/abc/../../users')).toBe('/');
    expect(nextAfterLogin('/users')).toBe('/');
  });
});

describe('qrProblem', () => {
  test('server answers about the code', () => {
    expect(qrProblem(httpError(404, { code: 'QR_GONE' }))).toEqual({ message: 'Deze code werkt niet meer. Vernieuw de code op het andere apparaat.', addPasskey: false });
    expect(qrProblem(httpError(409, { code: 'QR_TAKEN' }))).toEqual({ message: 'Iemand anders heeft deze code al gescand.', addPasskey: false });
    expect(qrProblem(httpError(409, { code: 'NO_PASSKEY' }))).toEqual({ message: 'Je hebt nog geen passkey. Voeg er een toe en scan de code opnieuw.', addPasskey: true });
  });

  test('everything else uses the passkey messages', () => {
    expect(qrProblem(httpError(401, { code: 'PASSKEY_FAILED' })).message).toBe('Er ging iets mis, probeer het opnieuw.');
    expect(qrProblem(Object.assign(new Error('x'), { name: 'NotAllowedError' })).message).toBe('Niet afgerond. Probeer het opnieuw.');
    expect(qrProblem(new AxiosError('offline')).message).toBe('Kan de server niet bereiken, controleer je verbinding.');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx --yes bun test src/lib/qr-login.test.ts`
Expected: FAIL, cannot find module `./qr-login`.

- [ ] **Step 3: Add the API calls to `src/lib/auth-api.ts`**

Append (keep the existing `LoginOptions` type; it is already declared in the file):

```ts
export interface QrStart {
  id: string;
  code: string;
  pollSecret: string;
  /** What the QR code contains: `${PUBLIC_APP_URL}/l/<code>` */
  url: string;
  expiresAt: string;
}

export type QrPoll =
  | { status: 'waiting' | 'denied' | 'expired'; expiresAt: string }
  | { status: 'scanned'; scannedBy: { name: string }; expiresAt: string }
  | ({ status: 'approved' } & SessionResult);

export interface QrScan {
  requester: { label: string; location: string | null };
  createdAt: string;
  options: LoginOptions['options'];
}

/** Laptop: a new code for the QR. */
export async function startQrLogin(): Promise<QrStart> {
  return (await api.post<QrStart>('/auth/qr')).data;
}

/** Laptop: 'gone' when the server no longer knows the code; network errors throw (try again on the next tick). */
export async function pollQrLogin(id: string, secret: string): Promise<QrPoll | 'gone'> {
  const response = await api.get<QrPoll>(`/auth/qr/${encodeURIComponent(id)}`, {
    headers: { 'X-Qr-Secret': secret },
    validateStatus: (status) => status === 200 || status === 404,
  });
  return response.status === 404 ? 'gone' : response.data;
}

/** Phone: claim the scanned code; gives who asks and the passkey options to confirm with. */
export async function scanQrLogin(code: string, authHeader: string): Promise<QrScan> {
  return (await api.post<QrScan>(`/auth/qr/scan/${encodeURIComponent(code)}`, undefined, { headers: { Authorization: authHeader } })).data;
}

/** Phone: confirm with a passkey (opens the fingerprint / face prompt). */
export async function approveQrLogin(code: string, scan: QrScan, authHeader: string): Promise<void> {
  const response = await startAuthentication({ optionsJSON: scan.options });
  await api.post(`/auth/qr/scan/${encodeURIComponent(code)}/approve`, { response }, { headers: { Authorization: authHeader } });
}

export async function denyQrLogin(code: string, authHeader: string): Promise<void> {
  await api.post(`/auth/qr/scan/${encodeURIComponent(code)}/deny`, undefined, { headers: { Authorization: authHeader } });
}
```

- [ ] **Step 4: Implement `src/lib/qr-login.ts`**

```ts
import { isAxiosError } from 'axios';
import type { QrPoll } from '@/lib/auth-api';
import { classifyPasskeyError, PASSKEY_MESSAGES } from '@/lib/passkey';

/** The laptop asks every 1.5 s whether the code was scanned */
export const QR_POLL_MS = 1500;
/** Codes live 2 minutes; the login page makes new ones for 10 minutes, then waits for a click (a forgotten tab stops polling) */
export const QR_RENEW_FOR_MS = 10 * 60 * 1000;

export type QrPanelState =
  | { phase: 'loading' }
  | { phase: 'waiting'; url: string; expiresAt: number }
  | { phase: 'scanned'; url: string; name: string }
  | { phase: 'done'; name: string }
  | { phase: 'expired' }
  | { phase: 'error' };

/** What the QR half shows after a poll; 'renew' = make a new code now. Approvals are handled by the caller. */
export function panelAfterPoll(poll: Exclude<QrPoll, { status: 'approved' }> | 'gone', url: string, renewingSince: number, now: number): QrPanelState | 'renew' {
  if (poll !== 'gone' && poll.status === 'waiting') return { phase: 'waiting', url, expiresAt: Date.parse(poll.expiresAt) };
  if (poll !== 'gone' && poll.status === 'scanned') return { phase: 'scanned', url, name: poll.scannedBy.name };
  return now - renewingSince < QR_RENEW_FOR_MS ? 'renew' : { phase: 'expired' };
}

/** Where to go after logging in: only back to a QR confirm link (`/l/<code>`), never to another page or site. */
export function nextAfterLogin(next: string | null): string {
  return next && /^\/l\/[A-Za-z0-9_-]{1,64}$/.test(next) ? next : '/';
}

export interface QrProblem {
  message: string;
  /** Offer "Passkey toevoegen" (the account has none, so it can not confirm) */
  addPasskey: boolean;
}

/** Why the phone can not confirm the code, in words for the drawer. */
export function qrProblem(error: unknown): QrProblem {
  if (isAxiosError<{ code?: unknown }>(error)) {
    const code = error.response?.data?.code;
    if (code === 'QR_GONE') return { message: 'Deze code werkt niet meer. Vernieuw de code op het andere apparaat.', addPasskey: false };
    if (code === 'QR_TAKEN') return { message: 'Iemand anders heeft deze code al gescand.', addPasskey: false };
    if (code === 'NO_PASSKEY') return { message: 'Je hebt nog geen passkey. Voeg er een toe en scan de code opnieuw.', addPasskey: true };
  }
  return { message: PASSKEY_MESSAGES[classifyPasskeyError(error)], addPasskey: false };
}
```

- [ ] **Step 5: Run the tests**

Run: `npx --yes bun test src/lib/qr-login.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Amend the spec**

In `docs/superpowers/specs/2026-10-14-passwordless-accounts-design.md`:
- In the **QrLogin** model bullet, replace `` `session token` handed over once on approval.`` with `` no token: the laptop's session is created when it collects the approval (atomic delete), so an approval nobody collects leaves no session. ``
- In the public endpoints table, replace the `GET /auth/qr/:id?secret=` row's path with `` `GET /auth/qr/:id` (header `X-Qr-Secret`) `` and keep its description.
- In the authenticated endpoints table, replace `` `GET /auth/qr/scan/:code` `` with `` `POST /auth/qr/scan/:code` ``, and append to its description: `` Users without a passkey get 409 `NO_PASSKEY`. Location = Cloudflare `cf-ipcity`, else the country from `cf-ipcountry`. ``

- [ ] **Step 7: Typecheck, lint, full test run**

Run: `npx --yes bun test && npx --yes bun x tsc -b && npx --yes bun run lint`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth-api.ts src/lib/qr-login.ts src/lib/qr-login.test.ts docs/superpowers/specs/2026-10-14-passwordless-accounts-design.md
git commit -m "feat(auth): QR login API calls and helpers; spec: POST scan, poll secret header

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Client — QR half of the login page (laptop)

**Files:**
- Create: `src/hooks/qr-login.hook.ts`, `src/components/auth/QrLoginPanel.tsx`
- Modify: `src/pages/Login.tsx`

**Interfaces:**
- Consumes: `startQrLogin`, `pollQrLogin`, `SessionResult` (Task 3, `src/lib/auth-api.ts`); `QR_POLL_MS`, `panelAfterPoll`, `QrPanelState`, `nextAfterLogin` (`src/lib/qr-login.ts`); `formatCountdown(ms)` (`src/lib/format.ts`); `TrackerQrCode({ value, size, label })` (`src/components/tracker/TrackerQrCode.tsx`); `CookieBadge({ tone, size })` (`src/components/tracker/CookieBadge.tsx`); `useIsMobile()` (`src/hooks/media.hook.ts`); `useStartSession()` (`src/hooks/start-session.hook.ts`).
- Produces: `useQrLogin(onApproved: (result: SessionResult) => void): { state: QrPanelState; restart: () => void }`; `QrLoginPanel({ onApproved })`. `Login` honours `?next=` (used by Task 5).

There is no React component test setup in this repo (tests are pure `src/lib` functions); the logic lives in the tested `panelAfterPoll`. This task is verified by typecheck/lint and the manual check in Step 5.

- [ ] **Step 1: Implement `src/hooks/qr-login.hook.ts`**

```ts
import { useEffect, useRef, useState } from 'react';
import { pollQrLogin, startQrLogin, type QrPoll, type QrStart, type SessionResult } from '@/lib/auth-api';
import { panelAfterPoll, QR_POLL_MS, type QrPanelState } from '@/lib/qr-login';

/** Laptop: show a code, poll it, make a new one when it expires (for 10 minutes), hand over the session on approval. */
export function useQrLogin(onApproved: (result: SessionResult) => void) {
  const [state, setState] = useState<QrPanelState>({ phase: 'loading' });
  // Bumped by "Nieuwe code" / "Niet jij? Opnieuw": starts over with a fresh code and a fresh 10 minutes
  const [round, setRound] = useState(0);
  const onApprovedRef = useRef(onApproved);
  useEffect(() => {
    onApprovedRef.current = onApproved;
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let qr: QrStart | null = null;
    const renewingSince = Date.now();

    async function renew() {
      try {
        qr = await startQrLogin();
      } catch {
        if (!cancelled) setState({ phase: 'error' });
        return;
      }
      if (cancelled) return;
      setState({ phase: 'waiting', url: qr.url, expiresAt: Date.parse(qr.expiresAt) });
      timer = setTimeout(poll, QR_POLL_MS);
    }

    async function poll() {
      if (!qr) return;
      let answer: QrPoll | 'gone' | null;
      try {
        answer = await pollQrLogin(qr.id, qr.pollSecret);
      } catch {
        // Network hiccup: keep the code and ask again
        answer = null;
      }
      if (cancelled) return;
      if (answer === null) {
        timer = setTimeout(poll, QR_POLL_MS);
        return;
      }
      if (answer !== 'gone' && answer.status === 'approved') {
        setState({ phase: 'done', name: answer.user.name });
        onApprovedRef.current({ token: answer.token, user: answer.user });
        return;
      }
      const next = panelAfterPoll(answer, qr.url, renewingSince, Date.now());
      if (next === 'renew') {
        void renew();
        return;
      }
      setState(next);
      if (next.phase !== 'expired') timer = setTimeout(poll, QR_POLL_MS);
    }

    setState({ phase: 'loading' });
    void renew();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [round]);

  return { state, restart: () => setRound((value) => value + 1) };
}
```

- [ ] **Step 2: Implement `src/components/auth/QrLoginPanel.tsx`**

Layout, copy and sizes follow the "laptop states" row of `qr-confirm.html` and the right half of login B.

```tsx
import { useEffect, useState } from 'react';
import { RefreshCwIcon, TimerIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import CookieBadge from '@/components/tracker/CookieBadge';
import TrackerQrCode from '@/components/tracker/TrackerQrCode';
import { useQrLogin } from '@/hooks/qr-login.hook';
import type { SessionResult } from '@/lib/auth-api';
import { formatCountdown } from '@/lib/format';

const QR_SIZE = 176;

/** Right half of the login card: log this laptop in by scanning the code with a phone that is already logged in. */
export default function QrLoginPanel({ onApproved }: { onApproved: (result: SessionResult) => void }) {
  const { state, restart } = useQrLogin(onApproved);

  return (
    <div className="flex w-[290px] flex-col items-center justify-center gap-3 p-8 text-center" aria-live="polite">
      {state.phase === 'loading' && (
        <>
          <Skeleton className="rounded-lg" style={{ width: QR_SIZE, height: QR_SIZE }} />
          <h2 className="text-base font-semibold">Inloggen met QR-code</h2>
          <p className="text-xs text-balance text-muted-foreground">Scan met de camera van een telefoon waarop je al bent ingelogd.</p>
        </>
      )}
      {state.phase === 'waiting' && (
        <>
          <TrackerQrCode value={state.url} size={QR_SIZE} label="QR-code om in te loggen" />
          <h2 className="text-base font-semibold">Inloggen met QR-code</h2>
          <p className="text-xs text-balance text-muted-foreground">Scan met de camera van een telefoon waarop je al bent ingelogd.</p>
          <Countdown until={state.expiresAt} />
        </>
      )}
      {state.phase === 'scanned' && (
        <>
          <div className="relative" style={{ width: QR_SIZE, height: QR_SIZE }}>
            <div className="absolute inset-0 opacity-30 blur-sm" aria-hidden>
              <TrackerQrCode value={state.url} size={QR_SIZE} label="" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-20 items-center justify-center rounded-full bg-sky-500/80 text-2xl font-bold text-white ring-4 ring-card">
                {state.name.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          <h2 className="text-base font-semibold">Bevestig op je telefoon</h2>
          <p className="text-xs text-muted-foreground">Gescand door {state.name}</p>
          <button type="button" onClick={restart} className="text-xs font-medium underline decoration-muted-foreground/50 underline-offset-2">
            Niet jij? Opnieuw
          </button>
        </>
      )}
      {state.phase === 'done' && (
        <>
          <CookieBadge tone="ok" size={72} />
          <h2 className="mt-2 text-base font-bold">Ingelogd</h2>
          <p className="text-xs text-muted-foreground">Welkom, {state.name}</p>
        </>
      )}
      {(state.phase === 'expired' || state.phase === 'error') && (
        <>
          <div className="flex items-center justify-center rounded-lg border border-dashed" style={{ width: QR_SIZE, height: QR_SIZE }}>
            <RefreshCwIcon className="size-8 text-muted-foreground" />
          </div>
          <h2 className="text-base font-semibold">{state.phase === 'expired' ? 'Code verlopen' : 'Kan geen code maken'}</h2>
          <p className="text-xs text-balance text-muted-foreground">
            {state.phase === 'expired' ? 'Maak een nieuwe code om met je telefoon in te loggen.' : 'Kan de server niet bereiken, controleer je verbinding.'}
          </p>
          <Button variant="outline" size="sm" onClick={restart}>
            Nieuwe code
          </Button>
        </>
      )}
    </div>
  );
}

function Countdown({ until }: { until: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <span className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
      <TimerIcon className="size-3.5" />
      Nieuwe code over {formatCountdown(until - now)}
    </span>
  );
}
```

`TrackerQrCode` with `label=""` inside an `aria-hidden` wrapper is decorative; keep it.

- [ ] **Step 3: Rewrite `src/pages/Login.tsx` as layout B**

```tsx
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { KeyRoundIcon, Loader2Icon } from 'lucide-react';
import usePWA from 'react-pwa-install-prompt';
import { isMobile as isMobileDevice } from 'react-device-detect';
import { Button } from '@/components/ui/button';
import AuthScreen from '@/components/auth/AuthScreen';
import QrLoginPanel from '@/components/auth/QrLoginPanel';
import { passkeyLogin, passkeysSupported, type SessionResult } from '@/lib/auth-api';
import { classifyPasskeyError, PASSKEY_MESSAGES } from '@/lib/passkey';
import { nextAfterLogin } from '@/lib/qr-login';
import { useStartSession } from '@/hooks/start-session.hook';
import { useIsMobile } from '@/hooks/media.hook';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startSession = useStartSession();
  const isMobile = useIsMobile();
  const { isStandalone, isInstallPromptSupported, promptInstall } = usePWA();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(passkeysSupported() ? null : PASSKEY_MESSAGES.unsupported);
  const next = nextAfterLogin(searchParams.get('next'));

  function enter(result: SessionResult) {
    if (!startSession(result)) throw new Error('Sign-in failed');
    navigate(next, { replace: true });
  }

  async function handleLogin() {
    setBusy(true);
    setError(null);
    try {
      enter(await passkeyLogin());
      if (isInstallPromptSupported && !isStandalone && isMobileDevice) promptInstall();
    } catch (failure) {
      setError(PASSKEY_MESSAGES[classifyPasskeyError(failure)]);
    } finally {
      setBusy(false);
    }
  }

  function handleQrApproved(result: SessionResult) {
    // Let "Ingelogd" show for a moment before the map takes over
    setTimeout(() => {
      try {
        enter(result);
      } catch (failure) {
        setError(PASSKEY_MESSAGES[classifyPasskeyError(failure)]);
      }
    }, 800);
  }

  return (
    <AuthScreen>
      <div className="w-full max-w-sm rounded-xl border bg-card text-card-foreground shadow-lg md:grid md:max-w-3xl md:grid-cols-[1fr_auto_auto]">
        <div className="flex flex-col justify-center gap-5 p-6 md:p-8">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="" className="size-10" />
            <div>
              <h1 className="text-xl font-bold leading-tight">Welkom terug!</h1>
              <p className="text-sm text-muted-foreground">Jotihunt Tracker</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Gebruik de vingerafdruk, het gezicht of de schermvergrendeling van dit apparaat.</p>
          <Button size="lg" className="w-full" onClick={handleLogin} disabled={busy || !passkeysSupported()}>
            {busy ? <Loader2Icon className="animate-spin" /> : <KeyRoundIcon />}
            Inloggen met passkey
          </Button>
          {error && (
            <p role="alert" className="text-xs font-medium text-destructive">
              {error}
            </p>
          )}
          <p className="text-xs text-muted-foreground">Geen account? Vraag de organisatie om een invite-link.</p>
        </div>
        {/* Phones log in with their own passkey; only laptops and the beamer need the code */}
        {!isMobile && (
          <>
            <div className="my-8 w-px bg-border" />
            <QrLoginPanel onApproved={handleQrApproved} />
          </>
        )}
      </div>
    </AuthScreen>
  );
}
```

`useIsMobile()` is `(max-width: 767px)`, the same breakpoint as Tailwind's `md:`, so the grid classes and the `!isMobile` switch agree.

- [ ] **Step 4: Typecheck, lint, tests**

Run: `npx --yes bun test && npx --yes bun x tsc -b && npx --yes bun run lint`
Expected: all pass.

- [ ] **Step 5: Manual check**

The controller runs a throwaway server + vite for the final check (Task 6); the implementer only needs to make sure the page renders: run `npx --yes bun x vite build` and expect a successful build.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/qr-login.hook.ts src/components/auth/QrLoginPanel.tsx src/pages/Login.tsx
git commit -m "feat(login): QR code half of the login card for laptops and the beamer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Client — `/l/:code` and the confirm drawer (phone)

**Files:**
- Create: `src/pages/QrLink.tsx`, `src/components/auth/QrConfirmDrawer.tsx`
- Modify: `src/Routes.tsx`, `src/Layout.tsx`

**Interfaces:**
- Consumes: `scanQrLogin`, `approveQrLogin`, `denyQrLogin`, `addPasskey`, `QrScan` (`src/lib/auth-api.ts`); `qrProblem`, `QrProblem` (`src/lib/qr-login.ts`); `classifyPasskeyError`, `PASSKEY_MESSAGES` (`src/lib/passkey.ts`); `formatLastUpdate(iso, now)` (`src/lib/tracker.ts`); `ResponsiveDialog` (`src/components/ResponsiveDialog.tsx`, props `open, onClose, title, description, hideHeader, compact`); `CookieBadge`; `useAuth().updateUserState` (`src/hooks/auth.hook.ts`); react-auth-kit v3 `useIsAuthenticated(): boolean`, `useAuthHeader(): string | null`, `useAuthUser<User>()`.
- Produces: route `/l/:code`; `location.state.qrLogin: string` on `/` opens `QrConfirmDrawer({ code, onClose })`.

Flow: the phone camera opens `/l/<code>`. Not logged in → `/login?next=/l/<code>` (Task 4 sends it back). Logged in → `/` with `state: { qrLogin: code }`, so the map and sidebar are underneath and the drawer slides up.

- [ ] **Step 1: Implement `src/pages/QrLink.tsx`**

```tsx
import { Navigate, useParams } from 'react-router';
import useIsAuthenticated from 'react-auth-kit/hooks/useIsAuthenticated';

/** A phone opened a laptop's QR code: confirm on the map, or log in first and come back. */
export default function QrLink() {
  const { code = '' } = useParams();
  const isAuthenticated = useIsAuthenticated();
  if (!isAuthenticated) return <Navigate to={`/login?next=${encodeURIComponent(`/l/${code}`)}`} replace />;
  return <Navigate to="/" replace state={{ qrLogin: code }} />;
}
```

- [ ] **Step 2: Add the route in `src/Routes.tsx`**

Add `const QrLink = lazy(() => import('./pages/QrLink'));` after the `Herstel` line, and `<Route path="/l/:code" element={<QrLink />} />` after the `/herstel/:token` route (outside `AuthOutlet`: it does its own redirect with `?next=`, which `AuthOutlet` can not).

- [ ] **Step 3: Implement `src/components/auth/QrConfirmDrawer.tsx`**

Copy and layout follow option C of `qr-confirm.html`.

```tsx
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { KeyRoundIcon, Loader2Icon, MapPinIcon, MonitorIcon, TriangleAlertIcon } from 'lucide-react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import CookieBadge from '@/components/tracker/CookieBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/auth.hook';
import { addPasskey, approveQrLogin, denyQrLogin, scanQrLogin, type QrScan } from '@/lib/auth-api';
import { classifyPasskeyError, PASSKEY_MESSAGES } from '@/lib/passkey';
import { qrProblem, type QrProblem } from '@/lib/qr-login';
import { formatLastUpdate } from '@/lib/tracker';
import type { User } from '@/types/User';

type View =
  | { step: 'loading' }
  | { step: 'ready'; scan: QrScan; busy: boolean; error: string | null }
  | { step: 'done'; label: string }
  | { step: 'problem'; problem: QrProblem };

/** Phone: someone shows this account's QR code on a laptop; confirm with a passkey (a grabbed, unlocked phone can not). */
export default function QrConfirmDrawer({ code, onClose }: { code: string; onClose: () => void }) {
  const authHeader = useAuthHeader();
  const user = useAuthUser<User>();
  const { updateUserState } = useAuth();
  const [view, setView] = useState<View>({ step: 'loading' });

  useEffect(() => {
    if (!authHeader) return;
    let cancelled = false;
    scanQrLogin(code, authHeader)
      .then((scan) => !cancelled && setView({ step: 'ready', scan, busy: false, error: null }))
      .catch((failure) => !cancelled && setView({ step: 'problem', problem: qrProblem(failure) }));
    return () => {
      cancelled = true;
    };
  }, [code, authHeader]);

  async function confirm(scan: QrScan) {
    if (!authHeader) return;
    setView({ step: 'ready', scan, busy: true, error: null });
    try {
      await approveQrLogin(code, scan, authHeader);
      setView({ step: 'done', label: scan.requester.label });
    } catch (failure) {
      const kind = classifyPasskeyError(failure);
      // Cancelled the prompt or a passkey that did not match: the code still waits, so stay and let them try again
      if (kind === 'cancelled' || kind === 'failed') setView({ step: 'ready', scan, busy: false, error: PASSKEY_MESSAGES[kind] });
      else setView({ step: 'problem', problem: qrProblem(failure) });
    }
  }

  async function refuse() {
    if (authHeader) await denyQrLogin(code, authHeader).catch(() => undefined);
    toast('Inloggen geweigerd');
    onClose();
  }

  async function handleAddPasskey() {
    if (!authHeader) return;
    try {
      await updateUserState(await addPasskey(authHeader));
      toast.success('Passkey toegevoegd', { description: 'Scan de code op het andere apparaat opnieuw.' });
      onClose();
    } catch (failure) {
      toast.error(PASSKEY_MESSAGES[classifyPasskeyError(failure)]);
    }
  }

  return (
    <ResponsiveDialog open onClose={onClose} title="Inloggen op een ander apparaat?" description="Bevestig met je passkey." hideHeader compact className="sm:max-w-md">
      <div className="flex flex-col gap-4 pb-2">
        {view.step === 'loading' && (
          <>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </>
        )}

        {view.step === 'ready' && (
          <>
            <div>
              <h2 className="text-lg font-semibold">Inloggen op een ander apparaat?</h2>
              <p className="text-sm text-muted-foreground">
                Iemand wil inloggen als <b className="text-foreground">{user?.name}</b>.
              </p>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
              <div className="flex items-center gap-2">
                <MonitorIcon className="size-4 text-muted-foreground" />
                {view.scan.requester.label}
              </div>
              <div className="flex items-center gap-2">
                <MapPinIcon className="size-4 text-muted-foreground" />
                {[view.scan.requester.location, formatLastUpdate(view.scan.createdAt, Date.now())].filter(Boolean).join(' · ')}
              </div>
            </div>
            <p className="flex gap-2 text-xs text-muted-foreground">
              <TriangleAlertIcon className="size-4 shrink-0 text-amber-500" />
              Alleen bevestigen als jij net zelf deze code scande.
            </p>
            {view.error && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {view.error}
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Button size="lg" className="w-full" onClick={() => confirm(view.scan)} disabled={view.busy}>
                {view.busy ? <Loader2Icon className="animate-spin" /> : <KeyRoundIcon />}
                Bevestigen met passkey
              </Button>
              <Button size="lg" variant="outline" className="w-full" onClick={refuse} disabled={view.busy}>
                Nee, dat ben ik niet
              </Button>
            </div>
          </>
        )}

        {view.step === 'done' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CookieBadge tone="ok" size={72} />
            <h2 className="text-lg font-bold">Ingelogd</h2>
            <p className="text-sm text-muted-foreground">{view.label} is nu ingelogd als {user?.name}.</p>
            <Button className="w-full" onClick={onClose}>
              Naar de kaart
            </Button>
          </div>
        )}

        {view.step === 'problem' && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">Dat lukte niet</h2>
              <p className="text-sm text-muted-foreground">{view.problem.message}</p>
            </div>
            {view.problem.addPasskey ? (
              <Button className="w-full" onClick={handleAddPasskey}>
                <KeyRoundIcon />
                Passkey toevoegen
              </Button>
            ) : null}
            <Button variant="outline" className="w-full" onClick={onClose}>
              Sluiten
            </Button>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  );
}
```

Before writing this file, open `src/hooks/auth.hook.ts` and `src/components/AddPasskeyPrompt.tsx` and confirm `useAuth()` returns `updateUserState` that accepts the `User` from `addPasskey` (that is how `AddPasskeyPrompt` uses it). Under React StrictMode the scan effect runs twice; that is fine because the server lets the same user scan again (the second challenge wins and the first answer is ignored through `cancelled`).

- [ ] **Step 4: Open the drawer from `src/Layout.tsx`**

Change the router import to `import {Outlet, useLocation, useNavigate} from 'react-router';`, import the drawer lazily next to the other imports:

```tsx
const QrConfirmDrawer = lazy(() => import('./components/auth/QrConfirmDrawer'));
```

(change the `react` import to `import {lazy, Suspense, useEffect, useRef, useState} from 'react';`), and replace `const {pathname} = useLocation();` with:

```tsx
    const location = useLocation();
    const {pathname} = location;
    const navigate = useNavigate();
    // Set by /l/:code: a laptop's QR code was scanned with this phone
    const qrLogin = (location.state as {qrLogin?: unknown} | null)?.qrLogin;
```

Inside the `<ErrorBoundary name="Dit venster" variant="floating">` block, after `<NotificationsDialog/>`, add:

```tsx
                {typeof qrLogin === 'string' && (
                    <Suspense fallback={null}>
                        <QrConfirmDrawer code={qrLogin} onClose={() => navigate('/', {replace: true, state: null})}/>
                    </Suspense>
                )}
```

Keep `Layout.tsx`'s own formatting (4-space indent, no spaces inside JSX braces).

- [ ] **Step 5: Typecheck, lint, tests, build**

Run: `npx --yes bun test && npx --yes bun x tsc -b && npx --yes bun run lint && npx --yes bun x vite build`
Expected: all pass, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/pages/QrLink.tsx src/components/auth/QrConfirmDrawer.tsx src/Routes.tsx src/Layout.tsx
git commit -m "feat(login): /l/:code opens a confirm drawer on the phone (passkey required)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: End-to-end smoke (controller)

Not for a subagent. With a throwaway server (`PORT=3101`, `MONGO_URI=mongodb://localhost:27017/jotihunt-passkey-smoke`, `WEBAUTHN_RP_ID=localhost`, `WEBAUTHN_ORIGINS=http://localhost:5191`, `PUBLIC_APP_URL=http://localhost:5191`, other external URLs pointing at `http://127.0.0.1:9`) and the client on vite `:5191` with `API_BASE_URL=http://localhost:3101`:

- [ ] curl: `POST /auth/qr` → 201; `GET /auth/qr/:id` with `X-Qr-Secret` → waiting; wrong secret → 404; scan without token → 401.
- [ ] User in the browser: `/login` on the laptop shows the QR with countdown; open the QR URL in a second browser profile that is logged in (desktop passkey) → drawer → `Bevestigen met passkey` → laptop shows "Ingelogd" and goes to the map. Also: `Nee, dat ben ik niet` → the laptop gets a new code; open `/l/<code>` logged out → login → back to the drawer.
- [ ] Stop both processes, drop `jotihunt-passkey-smoke`.
