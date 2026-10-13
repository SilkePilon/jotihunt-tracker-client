# Passwordless Accounts — Piece 1 (server core + login/invite/herstel pages) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace email + password login with passkeys: passkey login, Discord-style invite signup, admin herstel-links (recovery), 30-day sliding sessions, a CLI bootstrap link, and the new login / invite / herstel pages.

**Architecture:** New server module `src/auth/` holds config, models (on the *real* database connection so demo mode never logs anyone out), sessions, WebAuthn wrapper, invites, herstel-links and their controllers. The web token stays a JWT (react-auth-kit needs `exp`) but only carries a session id (`sid`); the session document decides validity. The client gets a passkey API module, three public pages sharing one backdrop component, and loses every password screen.

**Tech Stack:** Bun + Express 5 + Mongoose 9 + `@simplewebauthn/server` v13 (server); React 19 + react-auth-kit v3 + `@simplewebauthn/browser` v13 + shadcn/Tailwind v4 (client); `bun test` on both.

**Spec:** `docs/superpowers/specs/2026-10-14-passwordless-accounts-design.md` (client repo). Mockups: `/home/silke/Documents/Jotihunt 2026/.superpowers/brainstorm/129170-1791927526/content/login-layout-v2.html` (option B), `invite-page.html` (option C).

## Global Constraints

- Worktrees: server work in `/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-server-passwordless` (branch `feat/passwordless-accounts`, from server `main`); client work in `/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client-passwordless` (branch `feat/passwordless-accounts`). Never edit the main checkouts (the live docker stack builds from them).
- `bun` is not on PATH: use `npx --yes bun ...` (e.g. `npx --yes bun test src/auth`, `npx --yes bun x tsc --noEmit`). Client typecheck: `npx --yes bun x tsc -b`.
- MongoDB runs in docker on `localhost:27017`; tests use the `jotihunt-test` database (dropped by `connectTestDb`). Never touch other databases. Never `pkill -f`.
- Copy is Dutch, informal "je", short. UI text in this plan is final copy.
- No passwords anywhere after this piece: no `email`, `password`, `requiresPasswordChange`, `passwordChangedAt` on users; no `/auth/login`, `/auth/update-password`, `POST /admin/users`.
- Session lifetime: 30 days sliding (`SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000`), refreshed at most once per hour. Web JWT `exp` = 365 days, payload `{ sid, kind: "web" }`.
- WebAuthn: `userVerification: "required"` and `residentKey: "required"` everywhere; `attestationType: "none"`.
- Invite expiry keys: `30m`, `1h`, `6h`, `12h`, `1d` (default), `7d`, `never`. Max uses: `1, 5, 10, 25, 50, 100` or `null` (onbeperkt, default).
- Herstel-link lifetime: 1 hour, single use.
- Env (server): `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGINS` (comma list), `WEBAUTHN_RP_NAME` (default `Jotihunt Tracker`), `PUBLIC_APP_URL`, `HOME_TEAM_API_ID`, `GROUP_NAME`.
- Commit after every task with a conventional message ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

Server (`jotihunt-tracker-server-passwordless/src/`):

| File | Responsibility |
|---|---|
| `auth/config.ts` (+test) | Read and validate auth env (`webauthnConfig`, `publicAppUrl`, `groupConfig`) |
| `auth/auth-db.ts` | Which connection auth models live on (real DB in production, default in tests) |
| `auth/models.ts` | Session, Invite, RecoveryLink, AuthChallenge, InviteSetting models |
| `auth/hash.ts` | `sha256` |
| `auth/user-agent.ts` (+test) | `deviceLabel(ua)` → "Firefox op Linux" |
| `auth/public-user.ts` | `publicUser(user)` — the user shape sent to clients |
| `auth/user-store.ts` (+test) | `createAccount`, `updateAccounts` (mirrors to the real DB in demo mode) |
| `auth/sessions.ts` (+test) | create / use (sliding) / revoke sessions, sign session JWT |
| `auth/challenges.ts` (+test) | Store and take WebAuthn challenges |
| `auth/webauthn.ts` | Thin wrapper around `@simplewebauthn/server` (mocked in tests) |
| `auth/invites.ts` (+test) | Invite codes, state, atomic claim, list, revoke |
| `auth/invite-setting.ts` | Global "invites paused" switch |
| `auth/group-info.ts` | Home team name + logo for the invite page |
| `auth/recovery.ts` (+test) | Herstel-links |
| `auth/session-response.ts` | `startSession(user, req, via)` → `{ token, user }` |
| `auth/login.controller.ts` | Passkey login + `/auth/me` + `/auth/logout` |
| `auth/invite.controller.ts` | Public invite info + signup |
| `auth/recovery.controller.ts` | Public herstel-link flow |
| `auth/account.controller.ts` | Add a passkey to the own account |
| `auth/admin-auth.controller.ts` | Admin invites, recovery links, invites-paused |
| `auth/migrate.ts` (+test) | Idempotent migration of existing users |
| `auth/auth-flows.test.ts` | HTTP tests of all new endpoints |
| `routes/invites.route.ts`, `routes/herstel.route.ts`, `routes/account.route.ts` | New routers |
| `scripts/login-link.ts`, `scripts/migrate-passwordless.ts` | CLI |
| `test/auth.ts`, `test/webauthn.ts` | Test helpers |

Client (`jotihunt-tracker-client-passwordless/src/`):

| File | Responsibility |
|---|---|
| `lib/passkey.ts` (+test) | Error classification + Dutch copy, invite reason copy |
| `lib/auth-api.ts` | HTTP + WebAuthn calls for login/invite/herstel/add-passkey |
| `hooks/start-session.hook.ts` | Sign in to react-auth-kit with a `{ token, user }` result |
| `components/auth/AuthScreen.tsx` | Dimmed photo backdrop + credits footer |
| `components/auth/WelcomeCard.tsx` | CookieBadge success card |
| `pages/Login.tsx` | Login B (passkey half) |
| `pages/Invite.tsx` | Invite C |
| `pages/Herstel.tsx` | Herstel page |
| `components/AddPasskeyPrompt.tsx` | Toast nudging users without a passkey |
| `components/admin/RecoveryLinkDialog.tsx` | Admin herstel-link dialog |

---

## SERVER

### Task 1: Dependency, auth config and small helpers

**Files:**
- Modify: `package.json` (dependency + scripts)
- Create: `src/auth/config.ts`, `src/auth/config.test.ts`, `src/auth/hash.ts`, `src/auth/user-agent.ts`, `src/auth/user-agent.test.ts`
- Modify: `src/utils/mongo.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `webauthnConfig(env?) : { rpId: string; rpName: string; origins: string[] }` (throws when `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGINS` missing); `publicAppUrl(env?) : string` (throws when missing, no trailing slash); `groupConfig(env?) : { homeTeamApiId: number | null; groupName: string | null }`; `sha256(value: string): string` (hex); `deviceLabel(userAgent: string | undefined): string`; `isObjectIdString(value: unknown): value is string`.

- [ ] **Step 1: Install the library**

Run in the server worktree: `npx --yes bun add @simplewebauthn/server@^13`
Expected: `package.json` gains `"@simplewebauthn/server": "^13.x"`. Check `node_modules/@simplewebauthn/server/package.json` `version` starts with `13.`.

- [ ] **Step 2: Write the failing tests**

`src/auth/config.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { groupConfig, publicAppUrl, webauthnConfig } from "./config";

describe("webauthnConfig", () => {
  test("reads rp id, name and a comma separated origin list", () => {
    expect(webauthnConfig({ WEBAUTHN_RP_ID: "jotihunt.example", WEBAUTHN_ORIGINS: "https://jotihunt.example, http://localhost:5173 ", WEBAUTHN_RP_NAME: "JH" })).toEqual({
      rpId: "jotihunt.example",
      rpName: "JH",
      origins: ["https://jotihunt.example", "http://localhost:5173"],
    });
  });

  test("rp name defaults to Jotihunt Tracker", () => {
    expect(webauthnConfig({ WEBAUTHN_RP_ID: "a", WEBAUTHN_ORIGINS: "https://a" }).rpName).toBe("Jotihunt Tracker");
  });

  test("missing rp id or origins throws", () => {
    expect(() => webauthnConfig({ WEBAUTHN_ORIGINS: "https://a" })).toThrow("WEBAUTHN_RP_ID is not set");
    expect(() => webauthnConfig({ WEBAUTHN_RP_ID: "a", WEBAUTHN_ORIGINS: " , " })).toThrow("WEBAUTHN_ORIGINS is not set");
  });
});

describe("publicAppUrl", () => {
  test("strips trailing slashes", () => {
    expect(publicAppUrl({ PUBLIC_APP_URL: "https://jotihunt.example//" })).toBe("https://jotihunt.example");
  });
  test("missing throws", () => {
    expect(() => publicAppUrl({})).toThrow("PUBLIC_APP_URL is not set");
  });
});

describe("groupConfig", () => {
  test("parses the home team id and group name", () => {
    expect(groupConfig({ HOME_TEAM_API_ID: "66", GROUP_NAME: " Scouting De Bever " })).toEqual({ homeTeamApiId: 66, groupName: "Scouting De Bever" });
  });
  test("missing or invalid values are null", () => {
    expect(groupConfig({ HOME_TEAM_API_ID: "abc" })).toEqual({ homeTeamApiId: null, groupName: null });
  });
});
```

`src/auth/user-agent.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { deviceLabel } from "./user-agent";

describe("deviceLabel", () => {
  test.each([
    ["Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0", "Firefox op Linux"],
    ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36", "Chrome op Android"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1", "Safari op iPhone"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0", "Edge op Windows"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15", "Safari op macOS"],
    ["Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36", "Samsung Internet op Android"],
  ])("%s", (ua, label) => {
    expect(deviceLabel(ua)).toBe(label);
  });

  test("unknown or missing user agent", () => {
    expect(deviceLabel(undefined)).toBe("Onbekend apparaat");
    expect(deviceLabel("curl/8.0")).toBe("Onbekend apparaat");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx --yes bun test src/auth`
Expected: FAIL — cannot find module `./config` / `./user-agent`.

- [ ] **Step 4: Implement**

`src/auth/config.ts`:
```ts
type Env = Record<string, string | undefined>;

export interface WebauthnConfig {
  rpId: string;
  rpName: string;
  /** Every origin the site is served from (e.g. https://jotihunt.example and http://localhost:5173 in dev) */
  origins: string[];
}

/** WebAuthn relying party settings. Throws when a required variable is missing (checked at startup). */
export function webauthnConfig(env: Env = process.env): WebauthnConfig {
  const rpId = env.WEBAUTHN_RP_ID?.trim();
  if (!rpId) throw new Error("WEBAUTHN_RP_ID is not set");
  const origins = (env.WEBAUTHN_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0) throw new Error("WEBAUTHN_ORIGINS is not set");
  return { rpId, rpName: env.WEBAUTHN_RP_NAME?.trim() || "Jotihunt Tracker", origins };
}

/** Base URL of the web app, used in invite and herstel links. */
export function publicAppUrl(env: Env = process.env): string {
  const url = env.PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (!url) throw new Error("PUBLIC_APP_URL is not set");
  return url;
}

/** The own group, shown on the invite page. */
export function groupConfig(env: Env = process.env): { homeTeamApiId: number | null; groupName: string | null } {
  const id = Number(env.HOME_TEAM_API_ID);
  return { homeTeamApiId: Number.isInteger(id) && id > 0 ? id : null, groupName: env.GROUP_NAME?.trim() || null };
}
```

`src/auth/hash.ts`:
```ts
import { createHash } from "node:crypto";

/** Hex SHA-256; secrets in links are only stored hashed. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
```

`src/auth/user-agent.ts`:
```ts
const BROWSERS: [RegExp, string][] = [
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Edg(A|iOS)?\//, "Edge"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/OPR\//, "Opera"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/Android/, "Android"],
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Windows/, "Windows"],
  [/CrOS/, "ChromeOS"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];

/** Short Dutch label for a session or passkey, e.g. "Firefox op Linux". */
export function deviceLabel(userAgent: string | undefined): string {
  if (!userAgent) return "Onbekend apparaat";
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  if (!browser || !system) return "Onbekend apparaat";
  return `${browser} op ${system}`;
}
```

Append to `src/utils/mongo.ts`:
```ts
/** A 24 hex character ObjectId string (safe to pass to findById without a CastError). */
export function isObjectIdString(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{24}$/i.test(value);
}
```

Append to `.env.example` after `JWT_SECRET=`:
```
# Passkeys (WebAuthn). RP id = the site's host name without scheme/port (localhost in dev). Origins: every URL the
# web app is opened on, comma separated (e.g. https://jotihunt.example,http://localhost:5173).
WEBAUTHN_RP_ID=
WEBAUTHN_ORIGINS=
# WEBAUTHN_RP_NAME=Jotihunt Tracker
# Base URL of the web app, used in invite and herstel links (e.g. https://jotihunt.example)
PUBLIC_APP_URL=
# Own group on the invite page: Jotihunt team id (same as the client's HOME_TEAM_API_ID) and a fallback name
HOME_TEAM_API_ID=
GROUP_NAME=
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx --yes bun test src/auth`
Expected: PASS (all config + user-agent tests).

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock src/auth src/utils/mongo.ts .env.example
git commit -m "feat(auth): webauthn dependency, auth config and device labels

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
(If the lockfile is `bun.lockb`, add that instead.)

---

### Task 2: Auth models, user schema change and account store

**Files:**
- Create: `src/auth/auth-db.ts`, `src/auth/models.ts`, `src/auth/public-user.ts`, `src/auth/user-store.ts`, `src/auth/user-store.test.ts`
- Modify: `src/models/user.model.ts`

**Interfaces:**
- Consumes: `isObjectIdString` (Task 1).
- Produces:
  - `setAuthConnection(connection: Connection | null): void`, `authConnection(): Connection`, `authModel<T>(name, schema): Model<T>`
  - Model getters: `sessions()`, `invites()`, `recoveryLinks()`, `authChallenges()`, `inviteSettings()` with doc types `SessionDoc`, `InviteDoc`, `RecoveryLinkDoc`, `AuthChallengeDoc`, `InviteSettingDoc`; `type SessionVia = "passkey" | "invite" | "herstel" | "qr" | "cli"`.
  - `UserSchema` (exported), `User`, `UserType`, `type PasskeyFields = { credentialId: string; publicKey: Buffer; counter: number; transports: string[]; name: string }`, `newWebauthnUserId(): string`.
  - `publicUser(user) : PublicUser` where `PublicUser = { _id: string; name: string; admin: boolean; tutorialVersion: number; passkeyCount: number }`.
  - `createAccount(fields: { name: string; admin?: boolean; invite?: unknown; webauthnUserId?: string; passkey?: PasskeyFields }): Promise<UserType>`
  - `updateAccounts(filter: Record<string, unknown>, update: Record<string, unknown>): Promise<void>`

- [ ] **Step 1: Write the failing test**

`src/auth/user-store.test.ts`:
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import mongoose from "mongoose";
import { User } from "../models/user.model";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../test/db";
import { setDemoModeFlag } from "../demo/demo-mode";
import { setAuthConnection } from "./auth-db";
import { createAccount, updateAccounts } from "./user-store";
import { publicUser } from "./public-user";

const REAL_DB = "jotihunt-test-real";
let real: mongoose.Connection;

beforeAll(async () => {
  await connectTestDb();
  real = await mongoose.createConnection(process.env.MONGO_URI_TEST?.replace(/\/[^/]*$/, `/${REAL_DB}`) ?? `mongodb://localhost:27017/${REAL_DB}`).asPromise();
  await real.dropDatabase();
});
beforeEach(async () => {
  await clearTestDb();
  await real.collection("users").deleteMany({});
  setDemoModeFlag(false);
  setAuthConnection(null);
});
afterAll(async () => {
  setDemoModeFlag(false);
  setAuthConnection(null);
  await real.dropDatabase();
  await real.close();
  await disconnectTestDb();
});

const passkey = { credentialId: "cred-1", publicKey: Buffer.from("pk"), counter: 0, transports: ["internal"], name: "Chrome op Android" };

describe("createAccount", () => {
  test("creates a user with a passkey, webauthn id and timestamps", async () => {
    const user = await createAccount({ name: "Jesse", passkey });
    expect(user.name).toBe("Jesse");
    expect(user.admin).toBe(false);
    expect(user.webauthnUserId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(user.passkeys).toHaveLength(1);
    expect(user.passkeys[0].credentialId).toBe("cred-1");
    expect(user.lastActiveAt).toBeInstanceOf(Date);
  });

  test("outside demo mode only the default database gets the user", async () => {
    setAuthConnection(real);
    await createAccount({ name: "Jesse" });
    expect(await real.collection("users").countDocuments()).toBe(0);
  });

  test("in demo mode the user is mirrored to the real database with the same id", async () => {
    setAuthConnection(real);
    setDemoModeFlag(true);
    const user = await createAccount({ name: "Jesse", passkey });
    const mirrored = await real.collection("users").findOne({ _id: user._id });
    expect(mirrored?.name).toBe("Jesse");
    expect(mirrored?.passkeys).toHaveLength(1);
  });

  test("a passkey credential id is unique across users", async () => {
    await createAccount({ name: "A", passkey });
    await expect(createAccount({ name: "B", passkey })).rejects.toMatchObject({ code: 11000 });
  });

  test("users without passkeys never clash on the passkey index", async () => {
    await createAccount({ name: "A" });
    await createAccount({ name: "B" });
    expect(await User.countDocuments()).toBe(2);
  });
});

describe("updateAccounts", () => {
  test("in demo mode updates both databases", async () => {
    setAuthConnection(real);
    setDemoModeFlag(true);
    const user = await createAccount({ name: "Jesse" });
    await updateAccounts({ _id: user._id }, { $set: { name: "Jes" } });
    expect((await User.findById(user._id))?.name).toBe("Jes");
    expect((await real.collection("users").findOne({ _id: user._id }))?.name).toBe("Jes");
  });
});

describe("publicUser", () => {
  test("only sends id, name, admin, tour version and passkey count", async () => {
    const user = await createAccount({ name: "Jesse", passkey });
    expect(publicUser(user)).toEqual({ _id: String(user._id), name: "Jesse", admin: false, tutorialVersion: 0, passkeyCount: 1 });
  });

  test("toJSON hides passkeys and the webauthn id", async () => {
    const user = await createAccount({ name: "Jesse", passkey });
    const json = user.toJSON() as Record<string, unknown>;
    expect(json.passkeys).toBeUndefined();
    expect(json.webauthnUserId).toBeUndefined();
    expect(json.passkeyCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx --yes bun test src/auth/user-store.test.ts`
Expected: FAIL — cannot find module `./auth-db`.

- [ ] **Step 3: Implement**

`src/auth/auth-db.ts`:
```ts
import mongoose, { type Connection, type Model, type Schema } from "mongoose";

/**
 * Auth data (sessions, invites, herstel-links, challenges) lives in the REAL database, on the demo state store's
 * connection, so switching demo mode never logs anyone out. Tests and scripts leave it unset: the default connection.
 */
let real: Connection | null = null;

export function setAuthConnection(connection: Connection | null) {
  real = connection;
}

export function authConnection(): Connection {
  return real ?? mongoose.connection;
}

/** The model `name` on the auth connection, compiled on first use. */
export function authModel<T>(name: string, schema: Schema<T>): Model<T> {
  const connection = authConnection();
  return (connection.models[name] as Model<T> | undefined) ?? connection.model<T>(name, schema);
}
```

`src/auth/models.ts`:
```ts
import mongoose, { type Types } from "mongoose";
import { authModel } from "./auth-db";

export const SESSION_VIAS = ["passkey", "invite", "herstel", "qr", "cli"] as const;
export type SessionVia = (typeof SESSION_VIAS)[number];

/** A web login (one browser). The token is a JWT carrying this document's id; deleting it logs that browser out. */
export interface SessionDoc {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  /** "Firefox op Linux" */
  label: string;
  via: SessionVia;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
}

const SessionSchema = new mongoose.Schema<SessionDoc>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    label: { type: String, required: true },
    via: { type: String, enum: SESSION_VIAS, required: true },
    createdAt: { type: Date, required: true },
    lastUsedAt: { type: Date, required: true },
    // MongoDB removes expired sessions by itself
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { versionKey: false },
);

export interface InviteDoc {
  _id: Types.ObjectId;
  code: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  expiresAt: Date | null;
  maxUses: number | null;
  uses: number;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

const InviteSchema = new mongoose.Schema<InviteDoc>(
  {
    code: { type: String, required: true, unique: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, default: null },
    maxUses: { type: Number, default: null },
    uses: { type: Number, required: true, default: 0 },
    lastUsedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { versionKey: false },
);

/** One-time link that adds a new passkey to an account (lost phone, or the switch away from passwords). */
export interface RecoveryLinkDoc {
  _id: Types.ObjectId;
  tokenHash: string;
  user: Types.ObjectId;
  /** null when made with the CLI */
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
}

const RecoveryLinkSchema = new mongoose.Schema<RecoveryLinkDoc>(
  {
    tokenHash: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    createdAt: { type: Date, required: true },
    // Kept one day after expiry, then removed by MongoDB
    expiresAt: { type: Date, required: true, index: { expires: 24 * 60 * 60 } },
    usedAt: { type: Date, default: null },
  },
  { versionKey: false },
);

export const CHALLENGE_KINDS = ["login", "register", "add-passkey"] as const;
export type ChallengeKind = (typeof CHALLENGE_KINDS)[number];

/** A WebAuthn challenge between the options and verify calls (5 minutes, used once). */
export interface AuthChallengeDoc {
  _id: Types.ObjectId;
  kind: ChallengeKind;
  challenge: string;
  payload: Record<string, unknown>;
  expiresAt: Date;
}

const AuthChallengeSchema = new mongoose.Schema<AuthChallengeDoc>(
  {
    kind: { type: String, enum: CHALLENGE_KINDS, required: true },
    challenge: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { versionKey: false, minimize: false },
);

/** `{ key: "invites" }` in the settings collection: all invite links paused. */
export interface InviteSettingDoc {
  key: string;
  paused: boolean;
  updatedAt: Date | null;
  updatedBy: string | null;
}

const InviteSettingSchema = new mongoose.Schema<InviteSettingDoc>(
  {
    key: { type: String, required: true, unique: true },
    paused: { type: Boolean, required: true, default: false },
    updatedAt: { type: Date, default: null },
    updatedBy: { type: String, default: null },
  },
  { collection: "settings", versionKey: false },
);

export const sessions = () => authModel<SessionDoc>("Session", SessionSchema);
export const invites = () => authModel<InviteDoc>("Invite", InviteSchema);
export const recoveryLinks = () => authModel<RecoveryLinkDoc>("RecoveryLink", RecoveryLinkSchema);
export const authChallenges = () => authModel<AuthChallengeDoc>("AuthChallenge", AuthChallengeSchema);
export const inviteSettings = () => authModel<InviteSettingDoc>("InviteSetting", InviteSettingSchema);
```

`src/models/user.model.ts` — replace the `UserSchema` definition (fields `email`, `password`, `requiresPasswordChange`, `passwordChangedAt` go away), the `toJSON` transform, and delete `PASSWORD_HASH_OPTIONS`, `hashPassword`, `needsRehash`, `passwordChangeTime`. Keep `TrackerSchema`, `DeviceSchema`, `setTutorialVersion`. New parts:

```ts
import { randomBytes } from "node:crypto";
import mongoose, { HydratedDocument, InferSchemaType } from "mongoose";
import { VEHICLES } from "../services/tracker-onboarding.helpers";

// ... TrackerSchema and DeviceSchema unchanged ...

/** A WebAuthn credential (passkey) of the user */
const PasskeySchema = new mongoose.Schema({
  /** base64url credential id */
  credentialId: { type: String, required: true },
  publicKey: { type: Buffer, required: true },
  counter: { type: Number, required: true, default: 0 },
  transports: { type: [String], default: [] },
  /** "Chrome op Android"; renamable later */
  name: { type: String, required: true },
  createdAt: { type: Date, required: true },
  lastUsedAt: { type: Date, default: null },
});

/** Random WebAuthn user handle (never the Mongo id), base64url of 32 bytes */
export function newWebauthnUserId(): string {
  return randomBytes(32).toString("base64url");
}

export const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  admin: { type: Boolean, default: false, required: true },
  webauthnUserId: { type: String, required: true, default: newWebauthnUserId },
  passkeys: { type: [PasskeySchema], default: [] },
  /** The invite the account was made with (null: CLI or from before invites) */
  invite: { type: mongoose.Schema.Types.ObjectId, default: null },
  lastActiveAt: { type: Date, default: null },
  // ... tutorialVersion, notificationPrefs, readArticles, tracker, devices exactly as before ...
});

// A passkey belongs to one account. Partial: users without passkeys have no entry in the index.
UserSchema.index({ "passkeys.credentialId": 1 }, { unique: true, partialFilterExpression: { "passkeys.credentialId": { $exists: true } } });

// Never send key material, the WebAuthn handle or the read state (only served by GET /articles/read) to clients
UserSchema.set("toJSON", {
  transform: (_doc, ret: Record<string, unknown>) => {
    ret.passkeyCount = Array.isArray(ret.passkeys) ? ret.passkeys.length : 0;
    delete ret.passkeys;
    delete ret.webauthnUserId;
    delete ret.readArticles;
    return ret;
  },
});
```

`src/auth/public-user.ts`:
```ts
export interface PublicUser {
  _id: string;
  name: string;
  admin: boolean;
  tutorialVersion: number;
  passkeyCount: number;
}

/** The user as the web app stores it after logging in. */
export function publicUser(user: { _id: unknown; name: string; admin: boolean; tutorialVersion?: number | null; passkeys?: unknown[] | null }): PublicUser {
  return {
    _id: String(user._id),
    name: user.name,
    admin: user.admin,
    tutorialVersion: user.tutorialVersion ?? 0,
    passkeyCount: user.passkeys?.length ?? 0,
  };
}
```

`src/auth/user-store.ts`:
```ts
import mongoose, { type Model } from "mongoose";
import { isDemoMode } from "../demo/demo-mode";
import { newWebauthnUserId, User, UserSchema, type UserType } from "../models/user.model";
import { authConnection } from "./auth-db";

export interface PasskeyFields {
  credentialId: string;
  publicKey: Buffer;
  counter: number;
  transports: string[];
  name: string;
}

/**
 * The users collections an account change must reach: the current database, plus the real one while demo mode is on
 * (the demo database is thrown away when demo mode ends, accounts made meanwhile must survive).
 */
function userModels(): Model<unknown>[] {
  const real = authConnection();
  if (!isDemoMode() || real === mongoose.connection) return [User as unknown as Model<unknown>];
  const realUser = (real.models.User as Model<unknown> | undefined) ?? real.model("User", UserSchema);
  return [User as unknown as Model<unknown>, realUser];
}

export async function createAccount(fields: { name: string; admin?: boolean; invite?: unknown; webauthnUserId?: string; passkey?: PasskeyFields }): Promise<UserType> {
  const now = new Date();
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    name: fields.name,
    admin: fields.admin ?? false,
    invite: fields.invite ?? null,
    webauthnUserId: fields.webauthnUserId ?? newWebauthnUserId(),
    passkeys: fields.passkey ? [{ ...fields.passkey, createdAt: now, lastUsedAt: now }] : [],
    lastActiveAt: now,
  };
  // Real database first: when that fails (e.g. duplicate passkey) nothing is left half-created in the demo database
  for (const model of userModels().reverse()) await model.create(doc);
  return (await User.findById(doc._id))!;
}

export async function updateAccounts(filter: Record<string, unknown>, update: Record<string, unknown>): Promise<void> {
  for (const model of userModels()) await model.updateOne(filter, update);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx --yes bun test src/auth/user-store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth src/models/user.model.ts
git commit -m "feat(auth): passkeys on users, auth models on the real database, account store

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
(Typecheck is broken until Task 4 removes the password code; that is expected.)

---

### Task 3: Sessions and challenges

**Files:**
- Create: `src/auth/sessions.ts`, `src/auth/sessions.test.ts`, `src/auth/challenges.ts`, `src/auth/challenges.test.ts`, `src/test/auth.ts`

**Interfaces:**
- Consumes: `sessions()`, `authChallenges()`, `SessionVia`, `ChallengeKind` (Task 2); `isObjectIdString` (Task 1).
- Produces:
  - `SESSION_TTL_MS`, `SESSION_TOUCH_INTERVAL_MS`
  - `createSession(userId: unknown, info: { label: string; via: SessionVia }, now?: Date): Promise<{ token: string; sessionId: string }>`
  - `signSessionToken(sessionId: string): string`
  - `useSession(sessionId: string, now?: Date): Promise<SessionDoc | null>` (slides expiry; fire-and-forget write)
  - `revokeSession(sessionId: string): Promise<void>`, `revokeUserSessions(userId: unknown): Promise<void>`
  - `saveChallenge(kind: ChallengeKind, challenge: string, payload?: Record<string, unknown>, now?: Date): Promise<string>`
  - `takeChallenge(id: string, kind: ChallengeKind, now?: Date): Promise<{ challenge: string; payload: Record<string, unknown> } | null>`
  - test helpers `withSession<T extends { _id: unknown }>(user: T): Promise<T>` and `tokenFor(user): string`

- [ ] **Step 1: Write the failing tests**

`src/auth/sessions.test.ts`:
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../test/db";
import { sessions } from "./models";
import { createSession, revokeSession, revokeUserSessions, SESSION_TOUCH_INTERVAL_MS, SESSION_TTL_MS, useSession } from "./sessions";

process.env.JWT_SECRET ??= "test-secret-test-secret-test-secret";

beforeAll(connectTestDb);
beforeEach(clearTestDb);
afterAll(disconnectTestDb);

const userId = new mongoose.Types.ObjectId();
const t0 = new Date("2026-10-14T10:00:00Z");
const flush = () => new Promise((resolve) => setTimeout(resolve, 50));

describe("sessions", () => {
  test("the token is a JWT with sid and kind web, valid a year", async () => {
    const { token, sessionId } = await createSession(userId, { label: "Firefox op Linux", via: "passkey" }, t0);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { sid: string; kind: string; exp: number; iat: number };
    expect(decoded.sid).toBe(sessionId);
    expect(decoded.kind).toBe("web");
    expect(decoded.exp - decoded.iat).toBe(365 * 24 * 60 * 60);
    const stored = await sessions().findById(sessionId).lean();
    expect(stored).toMatchObject({ label: "Firefox op Linux", via: "passkey" });
    expect(stored!.expiresAt.getTime()).toBe(t0.getTime() + SESSION_TTL_MS);
  });

  test("useSession returns the session and does not write within the touch interval", async () => {
    const { sessionId } = await createSession(userId, { label: "x", via: "passkey" }, t0);
    const session = await useSession(sessionId, new Date(t0.getTime() + SESSION_TOUCH_INTERVAL_MS - 1));
    await flush();
    expect(String(session!._id)).toBe(sessionId);
    expect((await sessions().findById(sessionId).lean())!.lastUsedAt.getTime()).toBe(t0.getTime());
  });

  test("after the touch interval the expiry slides to 30 days from now", async () => {
    const { sessionId } = await createSession(userId, { label: "x", via: "passkey" }, t0);
    const later = new Date(t0.getTime() + 10 * 24 * 60 * 60 * 1000);
    await useSession(sessionId, later);
    await flush();
    const stored = (await sessions().findById(sessionId).lean())!;
    expect(stored.lastUsedAt.getTime()).toBe(later.getTime());
    expect(stored.expiresAt.getTime()).toBe(later.getTime() + SESSION_TTL_MS);
  });

  test("expired, revoked, unknown and malformed ids are null", async () => {
    const { sessionId } = await createSession(userId, { label: "x", via: "passkey" }, t0);
    expect(await useSession(sessionId, new Date(t0.getTime() + SESSION_TTL_MS))).toBeNull();
    expect(await useSession("nope")).toBeNull();
    expect(await useSession(String(new mongoose.Types.ObjectId()))).toBeNull();
    await revokeSession(sessionId);
    expect(await useSession(sessionId, t0)).toBeNull();
  });

  test("revokeUserSessions removes every session of that user only", async () => {
    await createSession(userId, { label: "a", via: "passkey" });
    await createSession(userId, { label: "b", via: "passkey" });
    const other = await createSession(new mongoose.Types.ObjectId(), { label: "c", via: "passkey" });
    await revokeUserSessions(userId);
    expect(await sessions().countDocuments()).toBe(1);
    expect(await useSession(other.sessionId)).not.toBeNull();
  });
});
```

`src/auth/challenges.test.ts`:
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../test/db";
import { saveChallenge, takeChallenge } from "./challenges";

beforeAll(connectTestDb);
beforeEach(clearTestDb);
afterAll(disconnectTestDb);

const t0 = new Date("2026-10-14T10:00:00Z");

describe("challenges", () => {
  test("a challenge can be taken once, with its payload", async () => {
    const id = await saveChallenge("register", "abc", { name: "Jesse" }, t0);
    expect(await takeChallenge(id, "register", t0)).toEqual({ challenge: "abc", payload: { name: "Jesse" } });
    expect(await takeChallenge(id, "register", t0)).toBeNull();
  });

  test("wrong kind, expired (5 min) or malformed ids are null", async () => {
    const id = await saveChallenge("login", "abc", {}, t0);
    expect(await takeChallenge(id, "register", t0)).toBeNull();
    expect(await takeChallenge(id, "login", new Date(t0.getTime() + 5 * 60 * 1000))).toBeNull();
    expect(await takeChallenge("nope", "login", t0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx --yes bun test src/auth/sessions.test.ts src/auth/challenges.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/auth/sessions.ts`:
```ts
import jwt from "jsonwebtoken";
import { logger } from "../logger";
import { isObjectIdString } from "../utils/mongo";
import { sessions, type SessionDoc, type SessionVia } from "./models";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** lastUsedAt/expiresAt are written at most this often (every request would be a database write) */
export const SESSION_TOUCH_INTERVAL_MS = 60 * 60 * 1000;
/** react-auth-kit needs an `exp`; the session document decides the real lifetime */
const TOKEN_TTL_SECONDS = 365 * 24 * 60 * 60;

export function signSessionToken(sessionId: string): string {
  return jwt.sign({ sid: sessionId, kind: "web" }, process.env.JWT_SECRET!, { expiresIn: TOKEN_TTL_SECONDS });
}

export async function createSession(userId: unknown, info: { label: string; via: SessionVia }, now = new Date()) {
  const session = await sessions().create({
    user: userId,
    label: info.label,
    via: info.via,
    createdAt: now,
    lastUsedAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
  });
  const sessionId = String(session._id);
  return { token: signSessionToken(sessionId), sessionId };
}

/** The live session with this id (null when unknown or expired). Slides the expiry at most once per hour. */
export async function useSession(sessionId: string, now = new Date()): Promise<SessionDoc | null> {
  if (!isObjectIdString(sessionId)) return null;
  const session = await sessions().findById(sessionId).lean<SessionDoc>();
  if (!session || session.expiresAt.getTime() <= now.getTime()) return null;
  if (now.getTime() - session.lastUsedAt.getTime() >= SESSION_TOUCH_INTERVAL_MS) {
    sessions()
      .updateOne({ _id: session._id }, { $set: { lastUsedAt: now, expiresAt: new Date(now.getTime() + SESSION_TTL_MS) } })
      .catch((error) => logger.warn(`Could not extend session: ${error}`));
  }
  return session;
}

export async function revokeSession(sessionId: string): Promise<void> {
  if (!isObjectIdString(sessionId)) return;
  await sessions().deleteOne({ _id: sessionId });
}

export async function revokeUserSessions(userId: unknown): Promise<void> {
  await sessions().deleteMany({ user: userId });
}
```

`src/auth/challenges.ts`:
```ts
import { isObjectIdString } from "../utils/mongo";
import { authChallenges, type ChallengeKind } from "./models";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export async function saveChallenge(kind: ChallengeKind, challenge: string, payload: Record<string, unknown> = {}, now = new Date()): Promise<string> {
  const doc = await authChallenges().create({ kind, challenge, payload, expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS) });
  return String(doc._id);
}

/** Take (and delete) a live challenge of this kind; null when unknown, expired, already used or of another kind. */
export async function takeChallenge(id: string, kind: ChallengeKind, now = new Date()) {
  if (!isObjectIdString(id)) return null;
  const doc = await authChallenges().findOneAndDelete({ _id: id, kind, expiresAt: { $gt: now } }).lean();
  return doc ? { challenge: doc.challenge, payload: (doc.payload ?? {}) as Record<string, unknown> } : null;
}
```

`src/test/auth.ts`:
```ts
import { createSession } from "../auth/sessions";

process.env.JWT_SECRET ??= "test-secret-test-secret-test-secret";

const tokens = new Map<string, string>();

/** Give a test user a web session; its token is then available through tokenFor(user). */
export async function withSession<T extends { _id: unknown }>(user: T): Promise<T> {
  const { token } = await createSession(user._id, { label: "Test", via: "passkey" });
  tokens.set(String(user._id), token);
  return user;
}

export function tokenFor(user: { _id: unknown }): string {
  const token = tokens.get(String(user._id));
  if (!token) throw new Error(`No session for user ${String(user._id)}: create the user with withSession()`);
  return token;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx --yes bun test src/auth/sessions.test.ts src/auth/challenges.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth src/test/auth.ts
git commit -m "feat(auth): sliding 30-day sessions and one-time webauthn challenges

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Session-based auth middleware; remove passwords everywhere

**Files:**
- Modify: `src/middleware/auth.middleware.ts`, `src/services/access-token.ts`, `src/controllers/auth.controller.ts`, `src/routes/auth.route.ts`, `src/controllers/admin.controller.ts`, `src/routes/admin.route.ts`, `src/demo/generator/generate-world.ts`, `package.json` (drop `create-user` script)
- Delete: `src/scripts/create-user.ts`, `src/utils/password-policy.ts` (and its test if present)
- Modify tests: `src/app.test.ts`, `src/routes/hunt-reports.route.test.ts`, `src/routes/life360.route.test.ts`, `src/routes/pairing.route.test.ts`, `src/routes/telegram.route.test.ts`, `src/demo/generator/generate-world.test.ts`, `src/demo/database-switch.test.ts`, `src/models/user.model.test.ts`, plus any test failing typecheck on removed fields

**Interfaces:**
- Consumes: `useSession`, `revokeUserSessions` (Task 3); `withSession`, `tokenFor` (Task 3); `isObjectIdString` (Task 1).
- Produces: `verifyToken` sets `req.user` and, for web sessions, `res.locals.sessionId: string`; device tokens set `res.locals.deviceId` as before. `signDeviceToken(user: { _id: unknown }, deviceId: string): string`. `isIssuedAfterPasswordChange`, `verifyTokenAllowingPasswordChange`, `PASSWORD_CHANGE_REQUIRED`, `signAccessToken` no longer exist.

- [ ] **Step 1: Rewrite the middleware tests first**

In `src/app.test.ts`:
1. Replace the imports/helpers at the top (lines 1–47) with:
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Article } from "./models/article.model";
import { User } from "./models/user.model";
import { sessions } from "./auth/models";
import { clearTestDb, connectTestDb, disconnectTestDb } from "./test/db";
import { tokenFor, withSession } from "./test/auth";

process.env.JWT_SECRET ??= "test-secret-test-secret-test-secret";
const { app, isQuietRequest } = await import("./app");

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

const sign = (payload: object, options: jwt.SignOptions = { expiresIn: "36h" }) => jwt.sign(payload, process.env.JWT_SECRET!, options);

async function createUser(fields: { admin?: boolean; name?: string } = {}) {
  return withSession(await User.create({ name: fields.name ?? "Test", admin: fields.admin ?? false }));
}

function request(path: string, init: RequestInit & { token?: string; json?: unknown } = {}) {
  const headers = new Headers(init.headers);
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  return fetch(`${base}${path}`, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
}
```
2. Replace the test `"missing, invalid, expired or wrongly shaped tokens get 401"` with:
```ts
  test("missing, invalid, expired, old-style or wrongly shaped tokens get 401", async () => {
    const user = await createUser();
    const sid = String((await sessions().findOne({ user: user._id }).lean())!._id);
    expect((await request("/markers")).status).toBe(401);
    expect((await request("/markers", { token: "nonsense" })).status).toBe(401);
    expect((await request("/markers", { token: sign({ sid }, { expiresIn: -10 }) })).status).toBe(401);
    // Password-era token: only an _id, no session
    expect((await request("/markers", { token: sign({ _id: String(user._id) }) })).status).toBe(401);
    expect((await request("/markers", { token: sign({ sid: "not-an-object-id" }) })).status).toBe(401);
    expect((await request("/markers", { token: sign({ sid: { $ne: null } }) })).status).toBe(401);
    expect((await request("/markers", { token: sign({ sid: String(new mongoose.Types.ObjectId()) }) })).status).toBe(401);
  });

  test("a revoked or expired session gets 401; a deleted user too", async () => {
    const user = await createUser();
    const token = tokenFor(user);
    await sessions().updateMany({ user: user._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await request("/markers", { token })).status).toBe(401);
    const other = await createUser();
    await sessions().deleteMany({ user: other._id });
    expect((await request("/markers", { token: tokenFor(other) })).status).toBe(401);
    const gone = await createUser();
    await User.deleteOne({ _id: gone._id });
    expect((await request("/markers", { token: tokenFor(gone) })).status).toBe(401);
  });
```
3. Delete the test `"tokens issued before the last password change get 401; users without the field keep working"`, the whole `describe("passwords", ...)`, `describe("minimum password length (8) ...", ...)`, `describe("required password change", ...)`, and the test `"a duplicate e-mail that slips past the validator is a 400, not a 500"`.
4. Every remaining `tokenFor(x, <iat>)` call becomes `tokenFor(x)`; every `createUser({ ..., password/email/requiresPasswordChange })` loses those fields.

In `src/routes/pairing.route.test.ts`: import `{ tokenFor, withSession } from "../test/auth"`; change `createUser` to `const createUser = async () => withSession(await User.create({ name: "Hunter" }));`; change `webToken` to `const webToken = (user: { _id: unknown }) => tokenFor(user);`; delete the test `"a password change also signs out paired phones"`; remove the `jsonwebtoken` import if now unused.

In `src/routes/life360.route.test.ts` and `src/routes/telegram.route.test.ts`: import `{ tokenFor, withSession } from "../test/auth"`; make `createUser` `async (admin = false) => withSession(await User.create({ name: admin ? "Admin" : "Hunter", admin }))` (keep the existing name scheme of each file); replace `tokenOf`'s body with `tokenFor(user)`; drop the `jsonwebtoken` import.

In `src/routes/hunt-reports.route.test.ts`: `token()` becomes
```ts
async function token() {
  const user = await withSession(await User.create({ name: "Hunter" }));
  return tokenFor(user);
}
```
(import from `../test/auth`, drop `jsonwebtoken`).

Add one device-token regression test to `src/routes/pairing.route.test.ts` (inside the existing describe):
```ts
  test("a device token without a registered device is a 401", async () => {
    const user = await createUser();
    const token = jwt.sign({ _id: String(user._id), did: "gone", kind: "device" }, process.env.JWT_SECRET!, { expiresIn: "1h" });
    expect((await request("/tracker/me", { token })).status).toBe(401);
  });
```
(keep `import jwt from "jsonwebtoken";` for this test).

- [ ] **Step 2: Run the suite to see it fail**

Run: `npx --yes bun test src/app.test.ts src/routes/pairing.route.test.ts`
Expected: FAIL — session tokens are rejected by the old middleware (401 where 200 expected).

- [ ] **Step 3: Rewrite the middleware**

`src/middleware/auth.middleware.ts` (whole file):
```ts
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model";
import { logger } from "../logger";
import { useSession } from "../auth/sessions";
import { isObjectIdString } from "../utils/mongo";

function denied(res: Response) {
  return res.status(401).json({ message: "Access denied" });
}

/**
 * Authenticate the request by its Bearer JWT: a web session (`sid`) or a paired phone (`_id` + `did`). Only a
 * missing/invalid token, a gone session/device or an unknown user get a 401 (clients sign out on 401). Database
 * errors go to the error handler (503), so a database hiccup never logs every hunter out.
 */
export default async function verifyToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return denied(res);

  let decoded: TokenPayload;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
  } catch {
    return denied(res);
  }
  if (typeof decoded !== "object" || decoded === null) return denied(res);

  if (decoded.sid !== undefined) {
    if (!isObjectIdString(decoded.sid)) return denied(res);
    let session;
    try {
      session = await useSession(decoded.sid);
    } catch (error) {
      return next(error);
    }
    if (!session) return denied(res);
    let user;
    try {
      user = await User.findById(session.user);
    } catch (error) {
      return next(error);
    }
    if (!user) return denied(res);
    req.user = user;
    res.locals.sessionId = decoded.sid;
    return next();
  }

  // Device tokens (paired phones) stay valid only while the device is still registered on the user
  if (!isObjectIdString(decoded._id) || typeof decoded.did !== "string") return denied(res);
  let user;
  try {
    user = await User.findById(decoded._id);
  } catch (error) {
    return next(error);
  }
  if (!user) {
    logger.warn(`User not found with ID ${decoded._id}`);
    return denied(res);
  }
  const device = user.devices?.find((entry) => entry.id === decoded.did);
  if (!device) return denied(res);
  touchDevice(user._id, device.id, device.lastSeenAt);
  res.locals.deviceId = device.id;
  req.user = user;
  next();
}

/** lastSeenAt of a device is written at most this often (every request would be a database write). */
const DEVICE_SEEN_INTERVAL_MS = 60 * 60 * 1000;

/** Fire-and-forget: a failed or late write (e.g. the user is gone) only logs a warning, never rejects. */
function touchDevice(userId: unknown, deviceId: string, lastSeenAt: Date | null | undefined) {
  const now = new Date();
  if (lastSeenAt && now.getTime() - lastSeenAt.getTime() < DEVICE_SEEN_INTERVAL_MS) return;
  User.updateOne({ _id: userId, "devices.id": deviceId }, { $set: { "devices.$.lastSeenAt": now } }).catch((error) =>
    logger.warn(`Could not update device lastSeenAt: ${error}`),
  );
}

export async function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ message: "Access denied" });
  if (!req.user.admin) return res.status(403).json({ message: "Access denied" });
  next();
}

interface TokenPayload {
  /** Web session id */
  sid?: unknown;
  /** User id (device tokens) */
  _id?: unknown;
  /** Device id of a paired phone (device tokens only) */
  did?: unknown;
}
```

`src/services/access-token.ts` (whole file):
```ts
import jwt from "jsonwebtoken";

export const DEVICE_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Token of a paired phone: valid 30 days, refreshable, revoked by removing the device from the user. */
export function signDeviceToken(user: { _id: unknown }, deviceId: string) {
  return jwt.sign({ _id: String(user._id), did: deviceId, kind: "device" }, process.env.JWT_SECRET!, { expiresIn: DEVICE_TOKEN_TTL_SECONDS });
}
```

`src/controllers/auth.controller.ts` (whole file — login/updatePassword are gone; `/auth/me` and `/auth/logout` come in Task 6):
```ts
import { Request, Response } from "express";
import { setTutorialVersion } from "../models/user.model";

export async function updateTutorial(req: Request, res: Response) {
  const tutorialVersion = await setTutorialVersion(req.user!, req.body.version);
  return res.status(200).json({ tutorialVersion });
}
```

`src/routes/auth.route.ts`: delete the imports of `verifyTokenAllowingPasswordChange`, `newPasswordRules`; delete `loginValidator`, `updatePasswordValidator`, `loginLimiter`, `loginIpLimiter` and the `/login` and `/update-password` routes; change `router.delete("/devices/me", verifyTokenAllowingPasswordChange, ...)` to `router.delete("/devices/me", verifyToken, pairingController.removeCurrent);` and remove the comment about a pending password change.

`src/controllers/admin.controller.ts`:
- imports: `import { User } from "../models/user.model";` and add `import { revokeUserSessions } from "../auth/sessions";`; drop `hashPassword`, `passwordChangeTime`, `isDuplicateKeyError`, `EMAIL_IN_USE`.
- `getUsers` becomes:
```ts
export async function getUsers(_req: Request, res: Response) {
  const users = await User.find().select("-readArticles -webauthnUserId").lean();
  return res.status(200).json(
    users.map(({ passkeys, ...user }) => ({ ...user, passkeyCount: passkeys?.length ?? 0 })),
  );
}
```
- delete `createUser`.
- in `deleteUser`, after `await PushSubscription.deleteMany({ user: id });` add `await revokeUserSessions(id);`.
- `updateUser` body becomes:
```ts
export async function updateUser(req: Request, res: Response) {
  const id = String(req.params.id);
  const data = matchedData(req);

  try {
    const result = await serializeAdminChange(async () => {
      const user = await User.findById(id);
      if (!user) return "not-found";
      if (data.admin === false && user.admin && !(await hasOtherAdmin(id))) return "last-admin";
      if (data.name) user.name = data.name;
      if (data.admin !== undefined) user.admin = data.admin;
      await user.save();
      return user;
    });
    if (result === "not-found") return res.status(404).json({ message: "User not found" });
    if (result === "last-admin") return res.status(409).json({ message: LAST_ADMIN });
    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error updating user", error);
    return res.status(500).json({ message: "Error updating user" });
  }
}
```

`src/routes/admin.route.ts`: delete `createValidator`, the `POST /users` route, the `email` and `password` validators in `updateValidator`, and the `newPasswordRules` import. `updateValidator` keeps `param("id")…`, `body("name").optional()…`, `body("admin").optional()…`.

Delete `src/scripts/create-user.ts` and `src/utils/password-policy.ts` (`git rm`); remove the `"create-user"` line from `package.json` scripts.

`src/demo/generator/generate-world.ts` around line 80: remove the `password` constant, and the `email`, `password`, `requiresPasswordChange` fields of the hunter docs; replace the cleanup `User.deleteMany({ email: { $in: docs.map((doc) => doc.email) } })` with `User.deleteMany({ name: { $in: docs.map((doc) => doc.name) }, admin: false })` (this only ever runs on the throwaway demo database). Update `generate-world.test.ts`: the seeded HQ user becomes `{ name: "HQ", admin: true }`, and the assertion at line 143 becomes `expect(hunters.every((user) => !user.admin)).toBe(true);`.

`src/demo/database-switch.test.ts` line ~117: create the user as `User.create({ name: "HQ", admin: true })` and assert `expect(copied?.name).toBe("HQ")` instead of email/password.

`src/models/user.model.test.ts`: in the legacy-document test, insert `{ name: "Old", admin: false }` and look it up with `User.findOne({ name: "Old" })`; replace `email: "tour@example.com", password: "x"` with nothing (`User.create({ name: "Tour" })`).

- [ ] **Step 4: Typecheck and clean the remaining test fixtures**

Run: `npx --yes bun x tsc --noEmit`
Expected: only errors in test files about `email` / `password` / `requiresPasswordChange` on `User.create(...)` literals (if any). Delete exactly those properties from each reported literal (e.g. `User.create({ email: "a@t.nl", password: "x", name: "A" })` → `User.create({ name: "A" })`). Re-run until clean.

Run: `grep -rn "requiresPasswordChange\|passwordChangedAt\|hashPassword\|signAccessToken\|password-policy" src`
Expected: no output.

- [ ] **Step 5: Run the whole suite**

Run: `npx --yes bun test`
Expected: PASS (all files).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(auth)!: session-based auth middleware, remove passwords

Web tokens now carry a session id; password login, password changes and
admin-created accounts are gone.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: WebAuthn wrapper and passkey login, me, logout

**Files:**
- Create: `src/auth/webauthn.ts`, `src/test/webauthn.ts`, `src/auth/session-response.ts`, `src/auth/login.controller.ts`, `src/auth/auth-flows.test.ts`
- Modify: `src/routes/auth.route.ts`

**Interfaces:**
- Consumes: `webauthnConfig` (T1); `saveChallenge`/`takeChallenge`, `createSession`, `revokeSession` (T3); `updateAccounts`, `publicUser`, `deviceLabel` (T1–2).
- Produces:
  - `registrationOptions(user: { webauthnUserId: string; name: string }, exclude: StoredPasskey[]): Promise<PublicKeyCredentialCreationOptionsJSON>`
  - `verifyRegistration(response: unknown, expectedChallenge: string): Promise<VerifiedPasskey | null>` (`VerifiedPasskey = { credentialId; publicKey: Buffer; counter; transports: string[] }`)
  - `authenticationOptions(allow?: StoredPasskey[]): Promise<PublicKeyCredentialRequestOptionsJSON>`
  - `verifyAuthentication(response: unknown, expectedChallenge: string, passkey: StoredPasskey): Promise<{ newCounter: number } | null>`
  - `startSession(user, req, via): Promise<{ token: string; user: PublicUser }>`
  - Error bodies used by the client: `{ message, code: "CHALLENGE_EXPIRED" }` (400), `{ message, code: "UNKNOWN_PASSKEY" }` (401), `{ message, code: "PASSKEY_FAILED" }` (401 login / 400 register).
  - Routes: `POST /auth/passkey/login/options` → `{ challengeId, options }`; `POST /auth/passkey/login/verify` body `{ challengeId, response }` → `{ token, user }`; `GET /auth/me` → `PublicUser`; `POST /auth/logout` → 204.

- [ ] **Step 1: Write the WebAuthn wrapper and its fake**

`src/auth/webauthn.ts`:
```ts
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { webauthnConfig } from "./config";

export interface StoredPasskey {
  credentialId: string;
  publicKey: Buffer;
  counter: number;
  transports: string[];
}
export type VerifiedPasskey = StoredPasskey;

const transports = (list: string[]) => list as AuthenticatorTransportFuture[];

/** The only module that talks to @simplewebauthn/server (tests replace it with src/test/webauthn.ts). */
export async function registrationOptions(user: { webauthnUserId: string; name: string }, exclude: StoredPasskey[]): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const { rpId, rpName } = webauthnConfig();
  return generateRegistrationOptions({
    rpName,
    rpID: rpId,
    userName: user.name,
    userDisplayName: user.name,
    userID: Buffer.from(user.webauthnUserId, "base64url"),
    attestationType: "none",
    excludeCredentials: exclude.map((passkey) => ({ id: passkey.credentialId, transports: transports(passkey.transports) })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
}

export async function verifyRegistration(response: unknown, expectedChallenge: string): Promise<VerifiedPasskey | null> {
  const { rpId, origins } = webauthnConfig();
  try {
    const result = await verifyRegistrationResponse({
      response: response as RegistrationResponseJSON,
      expectedChallenge,
      expectedOrigin: origins,
      expectedRPID: rpId,
      requireUserVerification: true,
    });
    if (!result.verified || !result.registrationInfo) return null;
    const { credential } = result.registrationInfo;
    return { credentialId: credential.id, publicKey: Buffer.from(credential.publicKey), counter: credential.counter, transports: credential.transports ?? [] };
  } catch {
    return null;
  }
}

export async function authenticationOptions(allow: StoredPasskey[] = []): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const { rpId } = webauthnConfig();
  return generateAuthenticationOptions({
    rpID: rpId,
    userVerification: "required",
    allowCredentials: allow.map((passkey) => ({ id: passkey.credentialId, transports: transports(passkey.transports) })),
  });
}

/** Null when the signature, challenge, origin, user verification or counter is wrong. */
export async function verifyAuthentication(response: unknown, expectedChallenge: string, passkey: StoredPasskey): Promise<{ newCounter: number } | null> {
  const { rpId, origins } = webauthnConfig();
  try {
    const result = await verifyAuthenticationResponse({
      response: response as AuthenticationResponseJSON,
      expectedChallenge,
      expectedOrigin: origins,
      expectedRPID: rpId,
      requireUserVerification: true,
      credential: { id: passkey.credentialId, publicKey: new Uint8Array(passkey.publicKey), counter: passkey.counter, transports: transports(passkey.transports) },
    });
    return result.verified ? { newCounter: result.authenticationInfo.newCounter } : null;
  } catch {
    return null;
  }
}
```

`src/test/webauthn.ts`:
```ts
import { mock } from "bun:test";
import type { StoredPasskey } from "../auth/webauthn";

/**
 * Fake WebAuthn for HTTP tests. A registration response `{ id }` registers credential `id` unless id is "bad"; an
 * authentication response `{ id, response: { signature: "valid" } }` passes. Challenges are fixed strings.
 */
export const fakeWebauthn = {
  registrationOptions: async (user: { webauthnUserId: string; name: string }, exclude: StoredPasskey[]) => ({
    challenge: "reg-challenge",
    rp: { id: "localhost", name: "Test" },
    user: { id: user.webauthnUserId, name: user.name, displayName: user.name },
    pubKeyCredParams: [],
    excludeCredentials: exclude.map((passkey) => ({ id: passkey.credentialId, type: "public-key" })),
  }),
  verifyRegistration: async (response: unknown, challenge: string) => {
    const id = (response as { id?: unknown })?.id;
    if (challenge !== "reg-challenge" || typeof id !== "string" || id === "bad") return null;
    return { credentialId: id, publicKey: Buffer.from(`pk-${id}`), counter: 0, transports: ["internal"] };
  },
  authenticationOptions: async (allow: StoredPasskey[] = []) => ({
    challenge: "auth-challenge",
    allowCredentials: allow.map((passkey) => ({ id: passkey.credentialId, type: "public-key" })),
  }),
  verifyAuthentication: async (response: unknown, challenge: string, passkey: StoredPasskey) => {
    const signature = (response as { response?: { signature?: unknown } })?.response?.signature;
    return challenge === "auth-challenge" && signature === "valid" ? { newCounter: passkey.counter + 1 } : null;
  },
};

/** Call before importing the app. */
export function installFakeWebauthn() {
  mock.module("../auth/webauthn", () => fakeWebauthn);
}
```

`src/auth/session-response.ts`:
```ts
import type { Request } from "express";
import type { SessionVia } from "./models";
import { createSession } from "./sessions";
import { deviceLabel } from "./user-agent";
import { publicUser } from "./public-user";

/** Log this browser in as `user`: the body every login/signup endpoint answers with. */
export async function startSession(user: Parameters<typeof publicUser>[0], req: Request, via: SessionVia) {
  const { token } = await createSession(user._id, { label: deviceLabel(req.get("user-agent")), via });
  return { token, user: publicUser(user) };
}

export const CHALLENGE_EXPIRED = { message: "Dat duurde te lang, probeer het opnieuw.", code: "CHALLENGE_EXPIRED" };
export const PASSKEY_FAILED = { message: "Dat lukte niet met deze passkey.", code: "PASSKEY_FAILED" };
export const UNKNOWN_PASSKEY = { message: "Deze passkey werkt niet meer.", code: "UNKNOWN_PASSKEY" };
```

- [ ] **Step 2: Write the failing HTTP tests**

`src/auth/auth-flows.test.ts` (later tasks append describes to this file):
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
  headers.set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0");
  return fetch(`${base}${path}`, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
}
const json = async <T = Record<string, unknown>>(res: Response) => (await res.json()) as T;
const passkey = (id: string) => ({ credentialId: id, publicKey: Buffer.from(`pk-${id}`), counter: 0, transports: ["internal"], name: "Test" });

async function loginWith(credentialId: string, signature = "valid") {
  const { challengeId } = await json<{ challengeId: string }>(await request("/auth/passkey/login/options", { method: "POST" }));
  return request("/auth/passkey/login/verify", { method: "POST", json: { challengeId, response: { id: credentialId, response: { signature } } } });
}

describe("passkey login", () => {
  test("a known passkey logs in: session token, public user, counter bumped", async () => {
    const user = await createAccount({ name: "Jesse", passkey: passkey("cred-1") });
    const res = await loginWith("cred-1");
    expect(res.status).toBe(200);
    const body = await json<{ token: string; user: Record<string, unknown> }>(res);
    expect(body.user).toEqual({ _id: String(user._id), name: "Jesse", admin: false, tutorialVersion: 0, passkeyCount: 1 });
    expect((await request("/auth/me", { token: body.token })).status).toBe(200);
    const stored = await User.findById(user._id);
    expect(stored!.passkeys[0].counter).toBe(1);
    expect(stored!.passkeys[0].lastUsedAt).toBeInstanceOf(Date);
    expect((await sessions().findOne({ user: user._id }).lean())!.label).toBe("Firefox op Linux");
  });

  test("an unknown passkey is a 401 UNKNOWN_PASSKEY, a bad signature 401 PASSKEY_FAILED", async () => {
    await createAccount({ name: "Jesse", passkey: passkey("cred-1") });
    const unknown = await loginWith("cred-x");
    expect(unknown.status).toBe(401);
    expect((await json(unknown)).code).toBe("UNKNOWN_PASSKEY");
    const bad = await loginWith("cred-1", "forged");
    expect(bad.status).toBe(401);
    expect((await json(bad)).code).toBe("PASSKEY_FAILED");
  });

  test("a challenge works once: replaying it is a 400 CHALLENGE_EXPIRED", async () => {
    await createAccount({ name: "Jesse", passkey: passkey("cred-1") });
    const { challengeId } = await json<{ challengeId: string }>(await request("/auth/passkey/login/options", { method: "POST" }));
    const body = { challengeId, response: { id: "cred-1", response: { signature: "valid" } } };
    expect((await request("/auth/passkey/login/verify", { method: "POST", json: body })).status).toBe(200);
    const replay = await request("/auth/passkey/login/verify", { method: "POST", json: body });
    expect(replay.status).toBe(400);
    expect((await json(replay)).code).toBe("CHALLENGE_EXPIRED");
  });
});

describe("me and logout", () => {
  test("logout revokes only the current session", async () => {
    const user = await withSession(await User.create({ name: "Jesse" }));
    const first = tokenFor(user);
    await withSession(user);
    const second = tokenFor(user);
    expect((await request("/auth/logout", { method: "POST", token: second })).status).toBe(204);
    expect((await request("/auth/me", { token: second })).status).toBe(401);
    expect((await request("/auth/me", { token: first })).status).toBe(200);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx --yes bun test src/auth/auth-flows.test.ts`
Expected: FAIL — 404 on `/auth/passkey/login/options`.

- [ ] **Step 4: Implement controller and routes**

`src/auth/login.controller.ts`:
```ts
import type { Request, Response } from "express";
import { User } from "../models/user.model";
import { saveChallenge, takeChallenge } from "./challenges";
import { revokeSession } from "./sessions";
import { publicUser } from "./public-user";
import { updateAccounts } from "./user-store";
import { authenticationOptions, verifyAuthentication } from "./webauthn";
import { CHALLENGE_EXPIRED, PASSKEY_FAILED, startSession, UNKNOWN_PASSKEY } from "./session-response";

/** Discoverable login: no user name, the browser offers the passkeys it has for this site. */
export async function loginOptions(_req: Request, res: Response) {
  const options = await authenticationOptions();
  const challengeId = await saveChallenge("login", options.challenge);
  return res.status(200).json({ challengeId, options });
}

export async function loginVerify(req: Request, res: Response) {
  const stored = await takeChallenge(String(req.body.challengeId), "login");
  if (!stored) return res.status(400).json(CHALLENGE_EXPIRED);
  const response = req.body.response as { id?: unknown } | undefined;
  const credentialId = typeof response?.id === "string" ? response.id : "";
  const user = credentialId ? await User.findOne({ "passkeys.credentialId": credentialId }) : null;
  const passkey = user?.passkeys.find((entry) => entry.credentialId === credentialId);
  if (!user || !passkey) return res.status(401).json(UNKNOWN_PASSKEY);

  const verified = await verifyAuthentication(response, stored.challenge, {
    credentialId: passkey.credentialId,
    publicKey: Buffer.from(passkey.publicKey),
    counter: passkey.counter,
    transports: [...passkey.transports],
  });
  if (!verified) return res.status(401).json(PASSKEY_FAILED);

  const now = new Date();
  await updateAccounts(
    { _id: user._id, "passkeys.credentialId": credentialId },
    { $set: { "passkeys.$.counter": verified.newCounter, "passkeys.$.lastUsedAt": now, lastActiveAt: now } },
  );
  return res.status(200).json(await startSession(user, req, "passkey"));
}

export function me(req: Request, res: Response) {
  return res.status(200).json(publicUser(req.user!));
}

/** Log this browser out (device tokens have their own unpair route). */
export async function logout(_req: Request, res: Response) {
  if (typeof res.locals.sessionId === "string") await revokeSession(res.locals.sessionId);
  return res.status(204).end();
}
```

In `src/routes/auth.route.ts` add (import `* as loginController from "../auth/login.controller"`, `{ body }` already imported):
```ts
// Brute force on verify: 30 failures per address per 15 minutes (each attempt needs a fresh challenge anyway)
const passkeyLimiter = limitFailures({
  windowMs: 15 * 60 * 1000,
  maxFailures: 30,
  failureStatus: 401,
  resetOnSuccess: false,
  key: (req) => String(req.ip),
});
const optionsLimiter = limitRate({ windowMs: 15 * 60 * 1000, max: 200, key: (req) => String(req.ip) });

router.post("/passkey/login/options", optionsLimiter, loginController.loginOptions);
router.post(
  "/passkey/login/verify",
  passkeyLimiter,
  validate([body("challengeId").isString().withMessage("challengeId ontbreekt."), body("response").isObject().withMessage("response ontbreekt.")]),
  loginController.loginVerify,
);
router.get("/me", verifyToken, loginController.me);
router.post("/logout", verifyToken, loginController.logout);
```
(import `limitRate` next to `limitFailures`.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx --yes bun test src/auth/auth-flows.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/auth src/test/webauthn.ts src/routes/auth.route.ts
git commit -m "feat(auth): passkey login, me and logout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Invites (service, public signup, admin endpoints, paused switch)

**Files:**
- Create: `src/auth/invites.ts`, `src/auth/invites.test.ts`, `src/auth/invite-setting.ts`, `src/auth/group-info.ts`, `src/auth/invite.controller.ts`, `src/auth/admin-auth.controller.ts`, `src/routes/invites.route.ts`
- Modify: `src/app.ts`, `src/routes/admin.route.ts`, `src/routes/settings.route.ts`, `src/auth/auth-flows.test.ts`

**Interfaces:**
- Consumes: `invites()`, `inviteSettings()`, `InviteDoc` (T2); `createAccount` (T2); `saveChallenge`/`takeChallenge` (T3); `registrationOptions`/`verifyRegistration` (T5); `startSession`, `CHALLENGE_EXPIRED`, `PASSKEY_FAILED` (T5); `groupConfig`, `publicAppUrl`, `deviceLabel` (T1); `presence` (`src/services/presence.service.ts`); `Team` model.
- Produces:
  - `INVITE_EXPIRY: Record<InviteExpiry, number | null>`, `type InviteExpiry = "30m" | "1h" | "6h" | "12h" | "1d" | "7d" | "never"`, `INVITE_MAX_USES = [1, 5, 10, 25, 50, 100]`
  - `type InviteState = "active" | "expired" | "revoked" | "full"`, `type InviteBlock = InviteState-without-active | "paused" | "unknown"`
  - `newInviteCode(): string` (8 chars of `23456789ABCDEFGHJKMNPQRSTVWXYZ`), `normalizeInviteCode(code: string): string`
  - `inviteState(invite, now?)`, `createInvite({ createdBy, expiry, maxUses }, now?)`, `findInvite(code)`, `claimInviteUse(code, now?)`, `releaseInviteUse(id)`, `revokeInvite(id, now?)`, `listInvites(now?)`, `inviteUrl(code)`
  - `invitesPaused(): Promise<boolean>`, `setInvitesPaused(paused: boolean, updatedBy: string | null)`
  - `groupInfo(): Promise<{ name: string; logoUrl: string | null }>`
  - Public routes: `GET /invites/:code` → `{ valid, reason, group, invitedBy, memberCount, onlineCount }` (404 + `{ valid: false, reason: "unknown" }` for unknown codes); `POST /invites/:code/register/options` body `{ name }` → `{ challengeId, options }`; `POST /invites/:code/register/verify` body `{ challengeId, response }` → 201 `{ token, user }`; `POST /invites/:code/register/no-passkey` body `{ name }` → 201 `{ token, user }`; blocked invites answer 410 `{ message: "Deze uitnodiging werkt niet meer.", reason }`.
  - Admin routes: `GET /admin/invites` → `AdminInvite[]`; `POST /admin/invites` body `{ expiry: InviteExpiry, maxUses: number | null }` → 201 `AdminInvite`; `DELETE /admin/invites/:id` → 200 `AdminInvite`; `GET /settings/invites-paused` → `{ paused }`; `PUT /settings/invites-paused` body `{ paused: boolean }` (admin) → `{ paused }`. `AdminInvite = { _id, code, url, createdBy: { _id, name } | null, createdAt, expiresAt, maxUses, uses, revokedAt, state }`.

- [ ] **Step 1: Write the failing unit tests**

`src/auth/invites.test.ts`:
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import mongoose from "mongoose";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../test/db";
import { claimInviteUse, createInvite, inviteState, listInvites, newInviteCode, normalizeInviteCode, revokeInvite } from "./invites";

beforeAll(connectTestDb);
beforeEach(clearTestDb);
afterAll(disconnectTestDb);

const admin = new mongoose.Types.ObjectId();
const t0 = new Date("2026-10-14T10:00:00Z");
const hours = (n: number) => new Date(t0.getTime() + n * 60 * 60 * 1000);

describe("codes", () => {
  test("8 characters without ambiguous ones", () => {
    for (let i = 0; i < 200; i++) expect(newInviteCode()).toMatch(/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);
  });
  test("normalize trims and uppercases", () => {
    expect(normalizeInviteCode(" k7p4qxab ")).toBe("K7P4QXAB");
  });
});

describe("state", () => {
  test("active, expired, revoked, full", async () => {
    const invite = await createInvite({ createdBy: admin, expiry: "1d", maxUses: 2 }, t0);
    expect(inviteState(invite, t0)).toBe("active");
    expect(inviteState(invite, hours(24))).toBe("expired");
    expect(inviteState({ ...invite, revokedAt: t0 }, t0)).toBe("revoked");
    expect(inviteState({ ...invite, uses: 2 }, t0)).toBe("full");
  });
  test("never expires and unlimited", async () => {
    const invite = await createInvite({ createdBy: admin, expiry: "never", maxUses: null }, t0);
    expect(invite.expiresAt).toBeNull();
    expect(inviteState({ ...invite, uses: 10_000 }, hours(10_000))).toBe("active");
  });
});

describe("claimInviteUse", () => {
  test("concurrent claims never exceed maxUses", async () => {
    const invite = await createInvite({ createdBy: admin, expiry: "1d", maxUses: 3 }, t0);
    const results = await Promise.all(Array.from({ length: 10 }, () => claimInviteUse(invite.code, t0)));
    expect(results.filter(Boolean)).toHaveLength(3);
  });
  test("expired or revoked invites can not be claimed; lowercase codes can", async () => {
    const invite = await createInvite({ createdBy: admin, expiry: "1h", maxUses: null }, t0);
    expect(await claimInviteUse(invite.code.toLowerCase(), t0)).not.toBeNull();
    expect(await claimInviteUse(invite.code, hours(2))).toBeNull();
    await revokeInvite(invite._id, t0);
    expect(await claimInviteUse(invite.code, t0)).toBeNull();
  });
});

describe("listInvites", () => {
  test("hides invites that stopped working more than a day ago", async () => {
    const active = await createInvite({ createdBy: admin, expiry: "7d", maxUses: null }, t0);
    const expiredLongAgo = await createInvite({ createdBy: admin, expiry: "30m", maxUses: null }, t0);
    const revokedJustNow = await createInvite({ createdBy: admin, expiry: "7d", maxUses: null }, t0);
    await revokeInvite(revokedJustNow._id, hours(47));
    const codes = (await listInvites(hours(48))).map((invite) => invite.code);
    expect(codes).toContain(active.code);
    expect(codes).toContain(revokedJustNow.code);
    expect(codes).not.toContain(expiredLongAgo.code);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx --yes bun test src/auth/invites.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the service, setting and group info**

`src/auth/invites.ts`:
```ts
import { randomInt } from "node:crypto";
import type { Types } from "mongoose";
import { isDuplicateKeyError } from "../utils/mongo";
import { publicAppUrl } from "./config";
import { invites, type InviteDoc } from "./models";

const MINUTE = 60 * 1000;
export const INVITE_EXPIRY = {
  "30m": 30 * MINUTE,
  "1h": 60 * MINUTE,
  "6h": 6 * 60 * MINUTE,
  "12h": 12 * 60 * MINUTE,
  "1d": 24 * 60 * MINUTE,
  "7d": 7 * 24 * 60 * MINUTE,
  never: null,
} as const satisfies Record<string, number | null>;
export type InviteExpiry = keyof typeof INVITE_EXPIRY;
export const INVITE_EXPIRY_KEYS = Object.keys(INVITE_EXPIRY) as InviteExpiry[];
export const INVITE_MAX_USES = [1, 5, 10, 25, 50, 100] as const;

/** No 0/O, 1/I/L or U: codes are read aloud and typed over at HQ */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
/** Stopped invites stay in the admin list this long */
const SHOW_STOPPED_MS = 24 * 60 * MINUTE;

export type InviteState = "active" | "expired" | "revoked" | "full";
export type InviteBlock = Exclude<InviteState, "active"> | "paused" | "unknown";

export function newInviteCode(): string {
  return Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export function normalizeInviteCode(code: string): string {
  return String(code).trim().toUpperCase();
}

export function inviteUrl(code: string): string {
  return `${publicAppUrl()}/invite/${code}`;
}

export function inviteState(invite: Pick<InviteDoc, "revokedAt" | "expiresAt" | "maxUses" | "uses">, now = new Date()): InviteState {
  if (invite.revokedAt) return "revoked";
  if (invite.expiresAt && invite.expiresAt.getTime() <= now.getTime()) return "expired";
  if (invite.maxUses !== null && invite.uses >= invite.maxUses) return "full";
  return "active";
}

export async function createInvite({ createdBy, expiry, maxUses }: { createdBy: unknown; expiry: InviteExpiry; maxUses: number | null }, now = new Date()): Promise<InviteDoc> {
  const ttl = INVITE_EXPIRY[expiry];
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const doc = await invites().create({
        code: newInviteCode(),
        createdBy,
        createdAt: now,
        expiresAt: ttl === null ? null : new Date(now.getTime() + ttl),
        maxUses,
        uses: 0,
        lastUsedAt: null,
        revokedAt: null,
      });
      return doc.toObject();
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
  }
  throw new Error("Could not create a unique invite code");
}

export function findInvite(code: string) {
  return invites().findOne({ code: normalizeInviteCode(code) }).lean<InviteDoc>();
}

/** Atomically use the invite once; null when it is unknown, revoked, expired or full. */
export function claimInviteUse(code: string, now = new Date()) {
  return invites()
    .findOneAndUpdate(
      {
        code: normalizeInviteCode(code),
        revokedAt: null,
        $and: [{ $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }, { $or: [{ maxUses: null }, { $expr: { $lt: ["$uses", "$maxUses"] } }] }],
      },
      { $inc: { uses: 1 }, $set: { lastUsedAt: now } },
      { returnDocument: "after" },
    )
    .lean<InviteDoc>();
}

/** Give a use back when the account could not be created after claiming it. */
export async function releaseInviteUse(id: Types.ObjectId): Promise<void> {
  await invites().updateOne({ _id: id, uses: { $gt: 0 } }, { $inc: { uses: -1 } });
}

export function revokeInvite(id: unknown, now = new Date()) {
  return invites().findOneAndUpdate({ _id: id, revokedAt: null }, { $set: { revokedAt: now } }, { returnDocument: "after" }).lean<InviteDoc>();
}

function stoppedAt(invite: InviteDoc, state: InviteState): Date {
  if (state === "revoked") return invite.revokedAt!;
  if (state === "expired") return invite.expiresAt!;
  return invite.lastUsedAt ?? invite.createdAt;
}

/** Newest first; invites that stopped working more than a day ago are left out. */
export async function listInvites(now = new Date()): Promise<InviteDoc[]> {
  const all = await invites().find({}).sort({ createdAt: -1 }).lean<InviteDoc[]>();
  return all.filter((invite) => {
    const state = inviteState(invite, now);
    return state === "active" || now.getTime() - stoppedAt(invite, state).getTime() < SHOW_STOPPED_MS;
  });
}
```

`src/auth/invite-setting.ts`:
```ts
import { inviteSettings } from "./models";

const KEY = "invites";

export async function invitesPaused(): Promise<boolean> {
  return (await inviteSettings().findOne({ key: KEY }).lean())?.paused ?? false;
}

export async function setInvitesPaused(paused: boolean, updatedBy: string | null): Promise<boolean> {
  await inviteSettings().updateOne({ key: KEY }, { $set: { paused, updatedAt: new Date(), updatedBy } }, { upsert: true });
  return paused;
}
```

`src/auth/group-info.ts`:
```ts
import { Team } from "../models/team.model";
import { groupConfig } from "./config";

/** The own group for the invite page: home team name + logo, else GROUP_NAME, else the app name. */
export async function groupInfo(): Promise<{ name: string; logoUrl: string | null }> {
  const { homeTeamApiId, groupName } = groupConfig();
  const team = homeTeamApiId ? await Team.findOne({ apiId: homeTeamApiId }, { name: 1, logoUrl: 1 }).lean() : null;
  return { name: team?.name ?? groupName ?? "Jotihunt Tracker", logoUrl: team?.logoUrl ?? null };
}
```

- [ ] **Step 4: Run unit tests**

Run: `npx --yes bun test src/auth/invites.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing HTTP tests**

Append to `src/auth/auth-flows.test.ts` (add imports `import { createInvite } from "./invites";`, `import { setInvitesPaused } from "./invite-setting";`, `import { Team } from "../models/team.model";`):
```ts
describe("invites: public", () => {
  test("info shows the group, inviter and counts; unknown codes are 404", async () => {
    process.env.HOME_TEAM_API_ID = "66";
    await Team.collection.insertOne({ apiId: 66, name: "Scouting Elburg", logoUrl: "https://cdn.jotihunt.net/elburg.png" });
    const admin = await User.create({ name: "Silke", admin: true });
    const invite = await createInvite({ createdBy: admin._id, expiry: "1d", maxUses: null });
    const res = await request(`/invites/${invite.code.toLowerCase()}`);
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ valid: true, reason: null, group: { name: "Scouting Elburg", logoUrl: "https://cdn.jotihunt.net/elburg.png" }, invitedBy: "Silke", memberCount: 1 });
    const unknown = await request("/invites/ZZZZZZZZ");
    expect(unknown.status).toBe(404);
    expect(await json(unknown)).toEqual({ valid: false, reason: "unknown" });
    delete process.env.HOME_TEAM_API_ID;
  });

  test("signup with a passkey: account, session, invite use, passkey stored", async () => {
    const admin = await User.create({ name: "Silke", admin: true });
    const invite = await createInvite({ createdBy: admin._id, expiry: "1d", maxUses: 1 });
    const options = await json<{ challengeId: string; options: { user: { name: string } } }>(
      await request(`/invites/${invite.code}/register/options`, { method: "POST", json: { name: "  Jesse " } }),
    );
    expect(options.options.user.name).toBe("Jesse");
    const res = await request(`/invites/${invite.code}/register/verify`, { method: "POST", json: { challengeId: options.challengeId, response: { id: "cred-new" } } });
    expect(res.status).toBe(201);
    const body = await json<{ token: string; user: { name: string; passkeyCount: number; admin: boolean } }>(res);
    expect(body.user).toMatchObject({ name: "Jesse", passkeyCount: 1, admin: false });
    expect((await request("/auth/me", { token: body.token })).status).toBe(200);
    const created = await User.findOne({ name: "Jesse" });
    expect(String(created!.invite)).toBe(String(invite._id));
    expect(created!.passkeys[0].name).toBe("Firefox op Linux");
    // maxUses 1: the next signup is refused
    const again = await request(`/invites/${invite.code}/register/no-passkey`, { method: "POST", json: { name: "Tim" } });
    expect(again.status).toBe(410);
    expect((await json(again)).reason).toBe("full");
  });

  test("signup without passkey works and gives a session", async () => {
    const admin = await User.create({ name: "Silke", admin: true });
    const invite = await createInvite({ createdBy: admin._id, expiry: "1d", maxUses: null });
    const res = await request(`/invites/${invite.code}/register/no-passkey`, { method: "POST", json: { name: "Tim" } });
    expect(res.status).toBe(201);
    expect((await json<{ user: { passkeyCount: number } }>(res)).user.passkeyCount).toBe(0);
  });

  test("a failed passkey does not use the invite; a bad name is a 400", async () => {
    const admin = await User.create({ name: "Silke", admin: true });
    const invite = await createInvite({ createdBy: admin._id, expiry: "1d", maxUses: 1 });
    const { challengeId } = await json<{ challengeId: string }>(await request(`/invites/${invite.code}/register/options`, { method: "POST", json: { name: "Jesse" } }));
    const bad = await request(`/invites/${invite.code}/register/verify`, { method: "POST", json: { challengeId, response: { id: "bad" } } });
    expect(bad.status).toBe(400);
    expect((await json(bad)).code).toBe("PASSKEY_FAILED");
    expect((await request(`/invites/${invite.code}/register/no-passkey`, { method: "POST", json: { name: "Jesse" } })).status).toBe(201);
    expect((await request(`/invites/${invite.code}/register/options`, { method: "POST", json: { name: "" } })).status).toBe(400);
  });

  test("paused invites are refused with reason paused", async () => {
    const admin = await User.create({ name: "Silke", admin: true });
    const invite = await createInvite({ createdBy: admin._id, expiry: "1d", maxUses: null });
    await setInvitesPaused(true, null);
    const info = await json(await request(`/invites/${invite.code}`));
    expect(info).toMatchObject({ valid: false, reason: "paused" });
    const res = await request(`/invites/${invite.code}/register/no-passkey`, { method: "POST", json: { name: "Tim" } });
    expect(res.status).toBe(410);
    expect((await json(res)).reason).toBe("paused");
  });
});

describe("invites: admin", () => {
  test("create, list, revoke; non-admins get 403", async () => {
    const admin = await withSession(await User.create({ name: "Silke", admin: true }));
    const hunter = await withSession(await User.create({ name: "Tim" }));
    expect((await request("/admin/invites", { token: tokenFor(hunter) })).status).toBe(403);
    const created = await request("/admin/invites", { method: "POST", token: tokenFor(admin), json: { expiry: "1d", maxUses: 25 } });
    expect(created.status).toBe(201);
    const invite = await json<{ _id: string; code: string; url: string; state: string; createdBy: { name: string } }>(created);
    expect(invite.url).toBe(`https://jotihunt.test/invite/${invite.code}`);
    expect(invite).toMatchObject({ state: "active", createdBy: { name: "Silke" } });
    expect((await json<unknown[]>(await request("/admin/invites", { token: tokenFor(admin) })))).toHaveLength(1);
    const revoked = await request(`/admin/invites/${invite._id}`, { method: "DELETE", token: tokenFor(admin) });
    expect((await json(revoked)).state).toBe("revoked");
    expect((await request(`/admin/invites/${invite._id}`, { method: "DELETE", token: tokenFor(admin) })).status).toBe(404);
  });

  test("invalid expiry or max uses is a 400", async () => {
    const admin = await withSession(await User.create({ name: "Silke", admin: true }));
    expect((await request("/admin/invites", { method: "POST", token: tokenFor(admin), json: { expiry: "2d", maxUses: null } })).status).toBe(400);
    expect((await request("/admin/invites", { method: "POST", token: tokenFor(admin), json: { expiry: "1d", maxUses: 3 } })).status).toBe(400);
  });

  test("invites-paused setting: read by anyone logged in, written by admins", async () => {
    const admin = await withSession(await User.create({ name: "Silke", admin: true }));
    const hunter = await withSession(await User.create({ name: "Tim" }));
    expect(await json(await request("/settings/invites-paused", { token: tokenFor(hunter) }))).toEqual({ paused: false });
    expect((await request("/settings/invites-paused", { method: "PUT", token: tokenFor(hunter), json: { paused: true } })).status).toBe(403);
    expect(await json(await request("/settings/invites-paused", { method: "PUT", token: tokenFor(admin), json: { paused: true } }))).toEqual({ paused: true });
  });
});
```

- [ ] **Step 6: Run to verify they fail**

Run: `npx --yes bun test src/auth/auth-flows.test.ts`
Expected: FAIL — 404 on `/invites/...` and `/admin/invites`.

- [ ] **Step 7: Implement controllers and routes**

`src/auth/invite.controller.ts`:
```ts
import { randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { User, type UserType } from "../models/user.model";
import { presence } from "../services/presence.service";
import { isDuplicateKeyError } from "../utils/mongo";
import { saveChallenge, takeChallenge } from "./challenges";
import { groupInfo } from "./group-info";
import { invitesPaused } from "./invite-setting";
import { claimInviteUse, findInvite, inviteState, normalizeInviteCode, releaseInviteUse, type InviteBlock } from "./invites";
import { CHALLENGE_EXPIRED, PASSKEY_FAILED, startSession } from "./session-response";
import { deviceLabel } from "./user-agent";
import { createAccount, type PasskeyFields } from "./user-store";
import { registrationOptions, verifyRegistration } from "./webauthn";

const INVITE_GONE = "Deze uitnodiging werkt niet meer.";

async function blockReason(code: string): Promise<InviteBlock | null> {
  const invite = await findInvite(code);
  if (!invite) return "unknown";
  const state = inviteState(invite);
  if (state !== "active") return state;
  return (await invitesPaused()) ? "paused" : null;
}

const gone = (res: Response, reason: InviteBlock) => res.status(410).json({ message: INVITE_GONE, reason });

export async function getInvite(req: Request, res: Response) {
  const invite = await findInvite(String(req.params.code));
  if (!invite) return res.status(404).json({ valid: false, reason: "unknown" });
  const reason = await blockReason(invite.code);
  const [group, inviter, memberCount] = await Promise.all([groupInfo(), User.findById(invite.createdBy, { name: 1 }).lean(), User.countDocuments()]);
  return res.status(200).json({ valid: reason === null, reason, group, invitedBy: inviter?.name ?? null, memberCount, onlineCount: presence.list().length });
}

export async function registerOptions(req: Request, res: Response) {
  const code = normalizeInviteCode(String(req.params.code));
  const reason = await blockReason(code);
  if (reason) return gone(res, reason);
  const name = String(req.body.name);
  const webauthnUserId = randomBytes(32).toString("base64url");
  const options = await registrationOptions({ webauthnUserId, name }, []);
  const challengeId = await saveChallenge("register", options.challenge, { source: "invite", code, name, webauthnUserId });
  return res.status(200).json({ challengeId, options });
}

/** Claim one use and create the account; the use is given back when creating fails. */
async function accountFromInvite(code: string, fields: { name: string; webauthnUserId?: string; passkey?: PasskeyFields }): Promise<UserType | InviteBlock> {
  if (await invitesPaused()) return "paused";
  const invite = await claimInviteUse(code);
  if (!invite) {
    const existing = await findInvite(code);
    if (!existing) return "unknown";
    const state = inviteState(existing);
    return state === "active" ? "full" : state;
  }
  try {
    return await createAccount({ ...fields, invite: invite._id });
  } catch (error) {
    await releaseInviteUse(invite._id);
    throw error;
  }
}

export async function registerVerify(req: Request, res: Response) {
  const code = normalizeInviteCode(String(req.params.code));
  const stored = await takeChallenge(String(req.body.challengeId), "register");
  if (!stored || stored.payload.source !== "invite" || stored.payload.code !== code) return res.status(400).json(CHALLENGE_EXPIRED);
  const verified = await verifyRegistration(req.body.response, stored.challenge);
  if (!verified) return res.status(400).json(PASSKEY_FAILED);
  let user;
  try {
    user = await accountFromInvite(code, {
      name: String(stored.payload.name),
      webauthnUserId: String(stored.payload.webauthnUserId),
      passkey: { ...verified, name: deviceLabel(req.get("user-agent")) },
    });
  } catch (error) {
    // The same passkey registered twice (double tap): the first account got it
    if (isDuplicateKeyError(error)) return res.status(400).json(PASSKEY_FAILED);
    throw error;
  }
  if (typeof user === "string") return gone(res, user);
  return res.status(201).json(await startSession(user, req, "invite"));
}

export async function registerWithoutPasskey(req: Request, res: Response) {
  const user = await accountFromInvite(normalizeInviteCode(String(req.params.code)), { name: String(req.body.name) });
  if (typeof user === "string") return gone(res, user);
  return res.status(201).json(await startSession(user, req, "invite"));
}
```

`src/auth/admin-auth.controller.ts`:
```ts
import type { Request, Response } from "express";
import { User } from "../models/user.model";
import { isObjectIdString } from "../utils/mongo";
import { invitesPaused, setInvitesPaused } from "./invite-setting";
import { createInvite, inviteState, inviteUrl, listInvites, revokeInvite, type InviteExpiry } from "./invites";
import type { InviteDoc } from "./models";

async function adminInvites(list: InviteDoc[], now = new Date()) {
  const creators = await User.find({ _id: { $in: list.map((invite) => invite.createdBy) } }, { name: 1 }).lean();
  const names = new Map(creators.map((creator) => [String(creator._id), creator.name]));
  return list.map((invite) => ({
    _id: String(invite._id),
    code: invite.code,
    url: inviteUrl(invite.code),
    createdBy: names.has(String(invite.createdBy)) ? { _id: String(invite.createdBy), name: names.get(String(invite.createdBy))! } : null,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    maxUses: invite.maxUses,
    uses: invite.uses,
    revokedAt: invite.revokedAt,
    state: inviteState(invite, now),
  }));
}

export async function getInvites(_req: Request, res: Response) {
  return res.status(200).json(await adminInvites(await listInvites()));
}

export async function postInvite(req: Request, res: Response) {
  const invite = await createInvite({ createdBy: req.user!._id, expiry: req.body.expiry as InviteExpiry, maxUses: req.body.maxUses ?? null });
  return res.status(201).json((await adminInvites([invite]))[0]);
}

export async function deleteInvite(req: Request, res: Response) {
  const id = String(req.params.id);
  const invite = isObjectIdString(id) ? await revokeInvite(id) : null;
  if (!invite) return res.status(404).json({ message: "Deze invite bestaat niet of is al ingetrokken." });
  return res.status(200).json((await adminInvites([invite]))[0]);
}

export async function getInvitesPaused(_req: Request, res: Response) {
  return res.status(200).json({ paused: await invitesPaused() });
}

export async function putInvitesPaused(req: Request, res: Response) {
  return res.status(200).json({ paused: await setInvitesPaused(req.body.paused, String(req.user!._id)) });
}
```

`src/routes/invites.route.ts`:
```ts
import express from "express";
import { body } from "express-validator";
import * as inviteController from "../auth/invite.controller";
import { validate } from "../middleware/validate.middleware";
import { limitFailures, limitRate } from "../middleware/rate-limit";

const nameRules = [body("name").isString().withMessage("Vul je naam in.").bail().trim().isLength({ min: 1, max: 40 }).withMessage("Je naam is 1 tot 40 tekens.")];

// Guessing codes: 30 unknown codes per address per 15 minutes
const lookupLimiter = limitFailures({ windowMs: 15 * 60 * 1000, maxFailures: 30, failureStatus: 404, resetOnSuccess: false, key: (req) => String(req.ip) });
const signupLimiter = limitRate({ windowMs: 15 * 60 * 1000, max: 60, key: (req) => String(req.ip) });

const router = express.Router();

router.get("/:code", lookupLimiter, inviteController.getInvite);
router.post("/:code/register/options", signupLimiter, validate(nameRules), inviteController.registerOptions);
router.post(
  "/:code/register/verify",
  signupLimiter,
  validate([body("challengeId").isString().withMessage("challengeId ontbreekt."), body("response").isObject().withMessage("response ontbreekt.")]),
  inviteController.registerVerify,
);
router.post("/:code/register/no-passkey", signupLimiter, validate(nameRules), inviteController.registerWithoutPasskey);

export default router;
```

`src/app.ts`: `import invitesRoute from "./routes/invites.route";` and after `app.use("/auth", authRoute);` add `app.use("/invites", invitesRoute);`.

`src/routes/admin.route.ts` (import `* as adminAuthController from "../auth/admin-auth.controller"` and `{ INVITE_EXPIRY_KEYS, INVITE_MAX_USES } from "../auth/invites"`):
```ts
router.get("/invites", [verifyToken, isAdmin], adminAuthController.getInvites);
router.post(
  "/invites",
  [
    verifyToken,
    isAdmin,
    validate([
      body("expiry").isIn(INVITE_EXPIRY_KEYS).withMessage("Ongeldige verlooptijd."),
      body("maxUses")
        .custom((value) => value === null || (INVITE_MAX_USES as readonly number[]).includes(value))
        .withMessage("Ongeldig aantal keer."),
    ]),
  ],
  adminAuthController.postInvite,
);
router.delete("/invites/:id", [verifyToken, isAdmin], adminAuthController.deleteInvite);
```

`src/routes/settings.route.ts` (import `* as adminAuthController from "../auth/admin-auth.controller"`):
```ts
router.get("/invites-paused", verifyToken, adminAuthController.getInvitesPaused);
router.put(
  "/invites-paused",
  [verifyToken, isAdmin, validate([body("paused").isBoolean({ strict: true }).withMessage("Paused moet true of false zijn.")])],
  adminAuthController.putInvitesPaused,
);
```

- [ ] **Step 8: Run tests**

Run: `npx --yes bun test src/auth`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/auth src/routes src/app.ts
git commit -m "feat(auth): invite links with expiry, max uses, revoke and pause; signup with passkey

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Herstel-links (recovery) and adding a passkey to the own account

**Files:**
- Create: `src/auth/recovery.ts`, `src/auth/recovery.controller.ts`, `src/auth/account.controller.ts`, `src/routes/herstel.route.ts`, `src/routes/account.route.ts`
- Modify: `src/app.ts`, `src/routes/admin.route.ts`, `src/auth/admin-auth.controller.ts`, `src/auth/auth-flows.test.ts`

**Interfaces:**
- Consumes: `recoveryLinks()` (T2), `sha256`, `publicAppUrl`, `deviceLabel` (T1), challenges (T3), webauthn (T5), `updateAccounts`, `publicUser`, `startSession` (T2/T5).
- Produces:
  - `RECOVERY_TTL_MS = 3_600_000`; `createRecoveryLink(userId, createdBy: unknown | null, now?): Promise<{ url: string; token: string; expiresAt: Date }>`; `findRecoveryLink(token, now?)`; `useRecoveryLink(token, now?)` (atomic, single use)
  - Public: `GET /herstel/:token` → `{ valid: true, name }` or 404 `{ valid: false }`; `POST /herstel/:token/register/options` → `{ challengeId, options }`; `POST /herstel/:token/register/verify` body `{ challengeId, response }` → 200 `{ token, user }`; `POST /herstel/:token/no-passkey` → 200 `{ token, user }`; used/expired → 410 `{ message: "Deze herstel-link werkt niet meer." }`.
  - Admin: `POST /admin/users/:id/recovery-link` → 201 `{ url, expiresAt }`.
  - Account: `POST /account/passkeys/options` → `{ challengeId, options }`; `POST /account/passkeys/verify` body `{ challengeId, response }` → 201 `{ user: PublicUser }`.

- [ ] **Step 1: Write the failing HTTP tests**

Append to `src/auth/auth-flows.test.ts` (import `{ createRecoveryLink } from "./recovery"`):
```ts
const tokenOf = (url: string) => url.split("/herstel/")[1];

describe("herstel-links", () => {
  test("admin makes a link; it adds a passkey, logs in, and works once", async () => {
    const admin = await withSession(await User.create({ name: "Silke", admin: true }));
    const mark = await User.create({ name: "Mark", admin: true });
    const made = await request(`/admin/users/${mark._id}/recovery-link`, { method: "POST", token: tokenFor(admin) });
    expect(made.status).toBe(201);
    const { url } = await json<{ url: string }>(made);
    expect(url).toStartWith("https://jotihunt.test/herstel/");
    const token = tokenOf(url);
    expect(await json(await request(`/herstel/${token}`))).toEqual({ valid: true, name: "Mark" });
    const { challengeId } = await json<{ challengeId: string }>(await request(`/herstel/${token}/register/options`, { method: "POST" }));
    const res = await request(`/herstel/${token}/register/verify`, { method: "POST", json: { challengeId, response: { id: "cred-mark" } } });
    expect(res.status).toBe(200);
    expect((await json<{ user: { name: string; passkeyCount: number } }>(res)).user).toMatchObject({ name: "Mark", passkeyCount: 1 });
    expect((await request(`/herstel/${token}`)).status).toBe(404);
    expect((await request(`/herstel/${token}/no-passkey`, { method: "POST" })).status).toBe(410);
  });

  test("without passkey: logs in once; expired links are 404", async () => {
    const user = await User.create({ name: "Tim" });
    const { url } = await createRecoveryLink(user._id, null);
    expect((await request(`/herstel/${tokenOf(url)}/no-passkey`, { method: "POST" })).status).toBe(200);
    const old = await createRecoveryLink(user._id, null, new Date(Date.now() - 2 * 60 * 60 * 1000));
    expect((await request(`/herstel/${tokenOf(old.url)}`)).status).toBe(404);
  });

  test("non-admins can not make links", async () => {
    const hunter = await withSession(await User.create({ name: "Tim" }));
    expect((await request(`/admin/users/${hunter._id}/recovery-link`, { method: "POST", token: tokenFor(hunter) })).status).toBe(403);
  });
});

describe("account: add passkey", () => {
  test("a logged-in user adds a passkey", async () => {
    const user = await withSession(await User.create({ name: "Tim" }));
    const { challengeId, options } = await json<{ challengeId: string; options: { excludeCredentials: unknown[] } }>(
      await request("/account/passkeys/options", { method: "POST", token: tokenFor(user) }),
    );
    expect(options.excludeCredentials).toEqual([]);
    const res = await request("/account/passkeys/verify", { method: "POST", token: tokenFor(user), json: { challengeId, response: { id: "cred-tim" } } });
    expect(res.status).toBe(201);
    expect((await json<{ user: { passkeyCount: number } }>(res)).user.passkeyCount).toBe(1);
  });

  test("a challenge of another user is refused", async () => {
    const a = await withSession(await User.create({ name: "A" }));
    const b = await withSession(await User.create({ name: "B" }));
    const { challengeId } = await json<{ challengeId: string }>(await request("/account/passkeys/options", { method: "POST", token: tokenFor(a) }));
    const res = await request("/account/passkeys/verify", { method: "POST", token: tokenFor(b), json: { challengeId, response: { id: "cred-b" } } });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx --yes bun test src/auth/auth-flows.test.ts`
Expected: FAIL — module `./recovery` not found.

- [ ] **Step 3: Implement**

`src/auth/recovery.ts`:
```ts
import { randomBytes } from "node:crypto";
import { publicAppUrl } from "./config";
import { sha256 } from "./hash";
import { recoveryLinks, type RecoveryLinkDoc } from "./models";

export const RECOVERY_TTL_MS = 60 * 60 * 1000;

export async function createRecoveryLink(userId: unknown, createdBy: unknown | null, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + RECOVERY_TTL_MS);
  await recoveryLinks().create({ tokenHash: sha256(token), user: userId, createdBy, createdAt: now, expiresAt, usedAt: null });
  return { url: `${publicAppUrl()}/herstel/${token}`, token, expiresAt };
}

export function findRecoveryLink(token: string, now = new Date()) {
  return recoveryLinks().findOne({ tokenHash: sha256(token), usedAt: null, expiresAt: { $gt: now } }).lean<RecoveryLinkDoc>();
}

/** Mark the link used (atomically, so two tabs can not both use it); null when it no longer works. */
export function useRecoveryLink(token: string, now = new Date()) {
  return recoveryLinks()
    .findOneAndUpdate({ tokenHash: sha256(token), usedAt: null, expiresAt: { $gt: now } }, { $set: { usedAt: now } }, { returnDocument: "after" })
    .lean<RecoveryLinkDoc>();
}
```

`src/auth/recovery.controller.ts`:
```ts
import type { Request, Response } from "express";
import { User } from "../models/user.model";
import { isDuplicateKeyError } from "../utils/mongo";
import { saveChallenge, takeChallenge } from "./challenges";
import { sha256 } from "./hash";
import { findRecoveryLink, useRecoveryLink } from "./recovery";
import { CHALLENGE_EXPIRED, PASSKEY_FAILED, startSession } from "./session-response";
import { deviceLabel } from "./user-agent";
import { updateAccounts } from "./user-store";
import { registrationOptions, verifyRegistration } from "./webauthn";

const LINK_GONE = { message: "Deze herstel-link werkt niet meer." };

const storedPasskeys = (user: { passkeys: { credentialId: string; publicKey: Buffer; counter: number; transports: string[] }[] }) =>
  user.passkeys.map((passkey) => ({ credentialId: passkey.credentialId, publicKey: Buffer.from(passkey.publicKey), counter: passkey.counter, transports: [...passkey.transports] }));

export async function getRecovery(req: Request, res: Response) {
  const link = await findRecoveryLink(String(req.params.token));
  const user = link ? await User.findById(link.user, { name: 1 }).lean() : null;
  if (!user) return res.status(404).json({ valid: false });
  return res.status(200).json({ valid: true, name: user.name });
}

export async function recoveryOptions(req: Request, res: Response) {
  const token = String(req.params.token);
  const link = await findRecoveryLink(token);
  const user = link ? await User.findById(link.user) : null;
  if (!user) return res.status(410).json(LINK_GONE);
  const options = await registrationOptions({ webauthnUserId: user.webauthnUserId, name: user.name }, storedPasskeys(user));
  const challengeId = await saveChallenge("register", options.challenge, { source: "herstel", tokenHash: sha256(token) });
  return res.status(200).json({ challengeId, options });
}

export async function recoveryVerify(req: Request, res: Response) {
  const token = String(req.params.token);
  const stored = await takeChallenge(String(req.body.challengeId), "register");
  if (!stored || stored.payload.source !== "herstel" || stored.payload.tokenHash !== sha256(token)) return res.status(400).json(CHALLENGE_EXPIRED);
  const verified = await verifyRegistration(req.body.response, stored.challenge);
  if (!verified) return res.status(400).json(PASSKEY_FAILED);
  const link = await useRecoveryLink(token);
  if (!link) return res.status(410).json(LINK_GONE);
  const now = new Date();
  try {
    await updateAccounts(
      { _id: link.user },
      { $push: { passkeys: { ...verified, name: deviceLabel(req.get("user-agent")), createdAt: now, lastUsedAt: now } }, $set: { lastActiveAt: now } },
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) return res.status(400).json(PASSKEY_FAILED);
    throw error;
  }
  const user = await User.findById(link.user);
  if (!user) return res.status(410).json(LINK_GONE);
  return res.status(200).json(await startSession(user, req, "herstel"));
}

export async function recoveryWithoutPasskey(req: Request, res: Response) {
  const link = await useRecoveryLink(String(req.params.token));
  const user = link ? await User.findById(link.user) : null;
  if (!user) return res.status(410).json(LINK_GONE);
  return res.status(200).json(await startSession(user, req, "herstel"));
}
```

`src/auth/account.controller.ts`:
```ts
import type { Request, Response } from "express";
import { User } from "../models/user.model";
import { isDuplicateKeyError } from "../utils/mongo";
import { saveChallenge, takeChallenge } from "./challenges";
import { publicUser } from "./public-user";
import { CHALLENGE_EXPIRED, PASSKEY_FAILED } from "./session-response";
import { deviceLabel } from "./user-agent";
import { updateAccounts } from "./user-store";
import { registrationOptions, verifyRegistration } from "./webauthn";

export async function addPasskeyOptions(req: Request, res: Response) {
  const user = req.user!;
  const exclude = user.passkeys.map((passkey) => ({ credentialId: passkey.credentialId, publicKey: Buffer.from(passkey.publicKey), counter: passkey.counter, transports: [...passkey.transports] }));
  const options = await registrationOptions({ webauthnUserId: user.webauthnUserId, name: user.name }, exclude);
  const challengeId = await saveChallenge("add-passkey", options.challenge, { userId: String(user._id) });
  return res.status(200).json({ challengeId, options });
}

export async function addPasskeyVerify(req: Request, res: Response) {
  const user = req.user!;
  const stored = await takeChallenge(String(req.body.challengeId), "add-passkey");
  if (!stored || stored.payload.userId !== String(user._id)) return res.status(400).json(CHALLENGE_EXPIRED);
  const verified = await verifyRegistration(req.body.response, stored.challenge);
  if (!verified) return res.status(400).json(PASSKEY_FAILED);
  const now = new Date();
  try {
    await updateAccounts({ _id: user._id }, { $push: { passkeys: { ...verified, name: deviceLabel(req.get("user-agent")), createdAt: now, lastUsedAt: null } } });
  } catch (error) {
    if (isDuplicateKeyError(error)) return res.status(400).json(PASSKEY_FAILED);
    throw error;
  }
  return res.status(201).json({ user: publicUser((await User.findById(user._id))!) });
}
```

Append to `src/auth/admin-auth.controller.ts` (import `{ createRecoveryLink } from "./recovery"`):
```ts
export async function postRecoveryLink(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!isObjectIdString(id) || !(await User.exists({ _id: id }))) return res.status(404).json({ message: "Er is geen gebruiker met dit ID." });
  const { url, expiresAt } = await createRecoveryLink(id, req.user!._id);
  return res.status(201).json({ url, expiresAt });
}
```
In `src/routes/admin.route.ts`: `router.post("/users/:id/recovery-link", [verifyToken, isAdmin], adminAuthController.postRecoveryLink);`

`src/routes/herstel.route.ts`:
```ts
import express from "express";
import { body } from "express-validator";
import * as recoveryController from "../auth/recovery.controller";
import { validate } from "../middleware/validate.middleware";
import { limitFailures, limitRate } from "../middleware/rate-limit";

const lookupLimiter = limitFailures({ windowMs: 15 * 60 * 1000, maxFailures: 30, failureStatus: 404, resetOnSuccess: false, key: (req) => String(req.ip) });
const useLimiter = limitRate({ windowMs: 15 * 60 * 1000, max: 60, key: (req) => String(req.ip) });

const router = express.Router();
router.get("/:token", lookupLimiter, recoveryController.getRecovery);
router.post("/:token/register/options", useLimiter, recoveryController.recoveryOptions);
router.post(
  "/:token/register/verify",
  useLimiter,
  validate([body("challengeId").isString().withMessage("challengeId ontbreekt."), body("response").isObject().withMessage("response ontbreekt.")]),
  recoveryController.recoveryVerify,
);
router.post("/:token/no-passkey", useLimiter, recoveryController.recoveryWithoutPasskey);
export default router;
```

`src/routes/account.route.ts`:
```ts
import express from "express";
import { body } from "express-validator";
import * as accountController from "../auth/account.controller";
import verifyToken from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";

const router = express.Router();
router.post("/passkeys/options", verifyToken, accountController.addPasskeyOptions);
router.post(
  "/passkeys/verify",
  [verifyToken, validate([body("challengeId").isString().withMessage("challengeId ontbreekt."), body("response").isObject().withMessage("response ontbreekt.")])],
  accountController.addPasskeyVerify,
);
export default router;
```

`src/app.ts`: import both routers; after `app.use("/invites", invitesRoute);` add `app.use("/herstel", herstelRoute);` and `app.use("/account", accountRoute);`.

- [ ] **Step 4: Run tests**

Run: `npx --yes bun test src/auth`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth src/routes src/app.ts
git commit -m "feat(auth): herstel-links and adding a passkey to the own account

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Startup wiring, migration and the login-link CLI

**Files:**
- Create: `src/auth/migrate.ts`, `src/auth/migrate.test.ts`, `src/scripts/migrate-passwordless.ts`, `src/scripts/login-link.ts`
- Modify: `src/index.ts`, `package.json`

**Interfaces:**
- Consumes: `setAuthConnection` (T2), `webauthnConfig`, `publicAppUrl` (T1), `createAccount` (T2), `createRecoveryLink` (T7), `getDemoStateStore` (existing).
- Produces: `migratePasswordless(connection: mongoose.Connection): Promise<{ cleaned: number; handles: number }>`; scripts `bun run migrate-passwordless`, `bun run login-link -- --user <name> | --id <id> | --new <name> [--admin]`.

- [ ] **Step 1: Write the failing migration test**

`src/auth/migrate.test.ts`:
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import mongoose from "mongoose";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../test/db";
import { User } from "../models/user.model";
import { migratePasswordless } from "./migrate";

beforeAll(connectTestDb);
beforeEach(clearTestDb);
afterAll(disconnectTestDb);

describe("migratePasswordless", () => {
  test("removes password fields, adds handles and passkeys, drops the email index; idempotent", async () => {
    const users = mongoose.connection.collection("users");
    await users.createIndex({ email: 1 }, { unique: true });
    await users.insertMany([
      { email: "a@test.nl", password: "$argon2id$x", name: "A", admin: true, requiresPasswordChange: false, passwordChangedAt: new Date() },
      { email: "b@test.nl", password: "$argon2id$y", name: "B", admin: false, requiresPasswordChange: true },
    ]);
    expect(await migratePasswordless(mongoose.connection)).toEqual({ cleaned: 2, handles: 2 });
    const docs = await users.find().toArray();
    for (const doc of docs) {
      expect(doc.email).toBeUndefined();
      expect(doc.password).toBeUndefined();
      expect(doc.requiresPasswordChange).toBeUndefined();
      expect(doc.webauthnUserId).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(doc.passkeys).toEqual([]);
    }
    const indexes = (await users.indexes()).map((index) => index.name);
    expect(indexes).not.toContain("email_1");
    const handles = docs.map((doc) => doc.webauthnUserId);
    expect(await migratePasswordless(mongoose.connection)).toEqual({ cleaned: 0, handles: 0 });
    expect((await users.find().toArray()).map((doc) => doc.webauthnUserId)).toEqual(handles);
    expect(await User.countDocuments()).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx --yes bun test src/auth/migrate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/auth/migrate.ts`:
```ts
import type mongoose from "mongoose";
import { newWebauthnUserId } from "../models/user.model";

/** One-off switch to passkeys: strip password data, give every user a WebAuthn handle, drop the e-mail index. */
export async function migratePasswordless(connection: mongoose.Connection): Promise<{ cleaned: number; handles: number }> {
  const users = connection.collection("users");
  const cleaned = await users.updateMany(
    { $or: [{ email: { $exists: true } }, { password: { $exists: true } }, { requiresPasswordChange: { $exists: true } }, { passwordChangedAt: { $exists: true } }] },
    { $unset: { email: "", password: "", requiresPasswordChange: "", passwordChangedAt: "" } },
  );
  let handles = 0;
  for (const doc of await users.find({ webauthnUserId: { $exists: false } }, { projection: { _id: 1 } }).toArray()) {
    const result = await users.updateOne({ _id: doc._id, webauthnUserId: { $exists: false } }, { $set: { webauthnUserId: newWebauthnUserId(), passkeys: [] } });
    handles += result.modifiedCount;
  }
  if ((await users.indexes()).some((index) => index.name === "email_1")) await users.dropIndex("email_1");
  return { cleaned: cleaned.modifiedCount, handles };
}
```

`src/scripts/migrate-passwordless.ts`:
```ts
import mongoose from "mongoose";
import { migratePasswordless } from "../auth/migrate";
import { User } from "../models/user.model";

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error("MONGO_URI is not set");
  process.exit(1);
}
await mongoose.connect(uri);
const result = await migratePasswordless(mongoose.connection);
// Creates the passkey index
await User.syncIndexes();
console.log(`Removed password data from ${result.cleaned} users, added WebAuthn handles to ${result.handles}.`);
await mongoose.disconnect();
```

`src/scripts/login-link.ts`:
```ts
import { parseArgs } from "node:util";
import mongoose from "mongoose";
import { User } from "../models/user.model";
import { createAccount } from "../auth/user-store";
import { createRecoveryLink } from "../auth/recovery";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: { user: { type: "string" }, id: { type: "string" }, new: { type: "string" }, admin: { type: "boolean", default: false } },
});

const uri = process.env.MONGO_URI;
if (!uri || !process.env.PUBLIC_APP_URL) {
  console.error("MONGO_URI and PUBLIC_APP_URL must be set");
  process.exit(1);
}
if (!values.user && !values.id && !values.new) {
  console.error("Usage: bun run login-link -- --user <name> | --id <user id> | --new <name> [--admin]");
  process.exit(1);
}

await mongoose.connect(uri);
let user;
if (values.new) {
  user = await createAccount({ name: values.new, admin: values.admin });
  console.log(`Created ${values.admin ? "admin " : ""}user ${user.name} (${user._id})`);
} else if (values.id) {
  user = await User.findById(values.id);
} else {
  const matches = await User.find({ name: values.user });
  if (matches.length > 1) {
    console.error(`${matches.length} users are called ${values.user}; use --id with one of: ${matches.map((match) => String(match._id)).join(", ")}`);
    process.exit(1);
  }
  user = matches[0];
}
if (!user) {
  console.error("User not found");
  process.exit(1);
}
const { url, expiresAt } = await createRecoveryLink(user._id, null);
console.log(`Herstel-link for ${user.name} (valid until ${expiresAt.toLocaleTimeString("nl-NL")}, works once):\n${url}`);
await mongoose.disconnect();
```

`package.json` scripts: add `"login-link": "bun run src/scripts/login-link.ts"` and `"migrate-passwordless": "bun run src/scripts/migrate-passwordless.ts"`.

`src/index.ts`:
1. After the JWT_SECRET checks add:
```ts
// Passkeys need the relying party settings; links need the public URL
try {
  webauthnConfig();
  publicAppUrl();
} catch (error) {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
```
2. After `await initPredictionSetting(getDemoStateStore());` add:
```ts
// Sessions, invites and herstel-links live in the real database, also while demo mode is on
setAuthConnection(getDemoStateStore().connection);
```
3. Imports: `import { publicAppUrl, webauthnConfig } from "./auth/config";` and `import { setAuthConnection } from "./auth/auth-db";`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx --yes bun test && npx --yes bun x tsc --noEmit && npx --yes bun run lint`
Expected: all PASS, no type or lint errors.

- [ ] **Step 5: Smoke test against a throwaway database**

```bash
export MONGO_URI=mongodb://localhost:27017/jotihunt-passkey-smoke PUBLIC_APP_URL=http://localhost:5191 JWT_SECRET=smoke-secret-smoke-secret-smoke-secret
npx --yes bun run migrate-passwordless
npx --yes bun run login-link -- --new Silke --admin
```
Expected: `Created admin user Silke (...)` and a `http://localhost:5191/herstel/<token>` line.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(auth): startup checks, passwordless migration and login-link CLI

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## CLIENT

### Task 9: Passkey client library and session hook

**Files:**
- Modify: `package.json` (dependency)
- Create: `src/lib/passkey.ts`, `src/lib/passkey.test.ts`, `src/lib/auth-api.ts`, `src/hooks/start-session.hook.ts`
- Modify: `src/types/User.ts`

**Interfaces:**
- Produces:
  - `type PasskeyFailure = 'cancelled' | 'unsupported' | 'unknown-passkey' | 'expired' | 'invite-gone' | 'link-gone' | 'rate-limited' | 'offline' | 'failed'`
  - `classifyPasskeyError(error: unknown): PasskeyFailure`, `PASSKEY_MESSAGES: Record<PasskeyFailure, string>`
  - `type InviteReason = 'expired' | 'revoked' | 'full' | 'paused' | 'unknown'`, `INVITE_REASON_TEXT: Record<InviteReason, string>`
  - `interface SessionResult { token: string; user: User }`, `interface InviteInfo { valid: boolean; reason: InviteReason | null; group: { name: string; logoUrl: string | null }; invitedBy: string | null; memberCount: number; onlineCount: number }`
  - `passkeysSupported(): boolean`, `passkeyLogin(): Promise<SessionResult>`, `fetchInvite(code): Promise<InviteInfo>` (404 resolves to `{ valid: false, reason: 'unknown', ... }`), `registerWithInvite(code, name): Promise<SessionResult>`, `registerWithInviteWithoutPasskey(code, name)`, `fetchRecovery(token): Promise<{ valid: boolean; name?: string }>`, `recoverWithPasskey(token)`, `recoverWithoutPasskey(token)`, `addPasskey(authHeader: string): Promise<User>`, `logoutSession(authHeader: string): Promise<void>`
  - `useStartSession(): (result: SessionResult) => boolean`
  - `User` type: `{ _id; name; admin; tutorialVersion?; passkeyCount?; lastActiveAt?; tracker? }`

- [ ] **Step 1: Install**

Run in the client worktree: `npx --yes bun add @simplewebauthn/browser@^13`
Expected: dependency added with a `13.x` version.

- [ ] **Step 2: Write the failing test**

`src/lib/passkey.test.ts`:
```ts
import { describe, expect, test } from 'bun:test';
import { AxiosError, AxiosHeaders } from 'axios';
import { classifyPasskeyError, PASSKEY_MESSAGES } from './passkey';

function httpError(status: number | undefined, data: unknown = {}) {
  const error = new AxiosError('fail');
  if (status !== undefined) error.response = { status, data, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } };
  return error;
}

describe('classifyPasskeyError', () => {
  test('browser ceremony errors', () => {
    expect(classifyPasskeyError(Object.assign(new Error('x'), { name: 'NotAllowedError' }))).toBe('cancelled');
    expect(classifyPasskeyError(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe('cancelled');
    expect(classifyPasskeyError(Object.assign(new Error('x'), { name: 'NotSupportedError' }))).toBe('unsupported');
    // @simplewebauthn wraps the DOMException in `cause`
    expect(classifyPasskeyError(Object.assign(new Error('x'), { name: 'WebAuthnError', cause: { name: 'NotAllowedError' } }))).toBe('cancelled');
  });

  test('server answers', () => {
    expect(classifyPasskeyError(httpError(undefined))).toBe('offline');
    expect(classifyPasskeyError(httpError(503))).toBe('offline');
    expect(classifyPasskeyError(httpError(429))).toBe('rate-limited');
    expect(classifyPasskeyError(httpError(401, { code: 'UNKNOWN_PASSKEY' }))).toBe('unknown-passkey');
    expect(classifyPasskeyError(httpError(400, { code: 'CHALLENGE_EXPIRED' }))).toBe('expired');
    expect(classifyPasskeyError(httpError(410, { reason: 'full' }))).toBe('invite-gone');
    expect(classifyPasskeyError(httpError(410, { message: 'Deze herstel-link werkt niet meer.' }))).toBe('link-gone');
    expect(classifyPasskeyError(httpError(401, { code: 'PASSKEY_FAILED' }))).toBe('failed');
  });

  test('every failure has Dutch copy without raw error names', () => {
    for (const message of Object.values(PASSKEY_MESSAGES)) {
      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toMatch(/Error/);
    }
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx --yes bun test src/lib/passkey.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

`src/lib/passkey.ts`:
```ts
import { isAxiosError } from 'axios';

export type PasskeyFailure = 'cancelled' | 'unsupported' | 'unknown-passkey' | 'expired' | 'invite-gone' | 'link-gone' | 'rate-limited' | 'offline' | 'failed';

/** What went wrong with a passkey login/signup: a browser ceremony error or the server's answer. */
export function classifyPasskeyError(error: unknown): PasskeyFailure {
  if (isAxiosError<{ code?: unknown; reason?: unknown }>(error)) {
    const status = error.response?.status;
    if (status === undefined || status >= 500) return 'offline';
    if (status === 429) return 'rate-limited';
    if (status === 410) return error.response?.data?.reason ? 'invite-gone' : 'link-gone';
    const code = error.response?.data?.code;
    if (code === 'UNKNOWN_PASSKEY') return 'unknown-passkey';
    if (code === 'CHALLENGE_EXPIRED') return 'expired';
    return 'failed';
  }
  const names = [(error as { name?: unknown })?.name, (error as { cause?: { name?: unknown } })?.cause?.name];
  if (names.some((name) => name === 'NotAllowedError' || name === 'AbortError')) return 'cancelled';
  if (names.some((name) => name === 'NotSupportedError' || name === 'SecurityError')) return 'unsupported';
  return 'failed';
}

export const PASSKEY_MESSAGES: Record<PasskeyFailure, string> = {
  cancelled: 'Niet afgerond. Probeer het opnieuw.',
  unsupported: 'Deze browser ondersteunt geen passkeys. Log in met de QR-code vanaf je telefoon.',
  'unknown-passkey': 'Deze passkey werkt niet meer. Vraag de organisatie om een herstel-link.',
  expired: 'Dat duurde te lang. Probeer het opnieuw.',
  'invite-gone': 'Deze uitnodiging werkt niet meer.',
  'link-gone': 'Deze herstel-link werkt niet meer. Vraag de organisatie om een nieuwe.',
  'rate-limited': 'Te veel pogingen, probeer het over een kwartier opnieuw.',
  offline: 'Kan de server niet bereiken, controleer je verbinding.',
  failed: 'Er ging iets mis, probeer het opnieuw.',
};

export type InviteReason = 'expired' | 'revoked' | 'full' | 'paused' | 'unknown';

export const INVITE_REASON_TEXT: Record<InviteReason, string> = {
  expired: 'De link is verlopen. Vraag de organisatie om een nieuwe.',
  revoked: 'De link is ingetrokken. Vraag de organisatie om een nieuwe.',
  full: 'De link is al te vaak gebruikt. Vraag de organisatie om een nieuwe.',
  paused: 'Uitnodigen staat even uit. Probeer het later opnieuw.',
  unknown: 'Deze link bestaat niet. Controleer of je hem helemaal hebt gekopieerd.',
};
```

`src/lib/auth-api.ts`:
```ts
import axios from 'axios';
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { REQUEST_TIMEOUT_MS } from '@/lib/http';
import type { User } from '@/types/User';
import type { InviteReason } from '@/lib/passkey';

/** Passkey prompts wait for the user (fingerprint, phone nearby): the server calls themselves are quick */
const api = axios.create({ baseURL: import.meta.env.API_BASE_URL, timeout: REQUEST_TIMEOUT_MS });

export interface SessionResult {
  token: string;
  user: User;
}

export interface InviteInfo {
  valid: boolean;
  reason: InviteReason | null;
  group: { name: string; logoUrl: string | null };
  invitedBy: string | null;
  memberCount: number;
  onlineCount: number;
}

type Options = { challengeId: string; options: Parameters<typeof startRegistration>[0]['optionsJSON'] };
type LoginOptions = { challengeId: string; options: Parameters<typeof startAuthentication>[0]['optionsJSON'] };

export function passkeysSupported(): boolean {
  return browserSupportsWebAuthn();
}

export async function passkeyLogin(): Promise<SessionResult> {
  const { data } = await api.post<LoginOptions>('/auth/passkey/login/options');
  const response = await startAuthentication({ optionsJSON: data.options });
  return (await api.post<SessionResult>('/auth/passkey/login/verify', { challengeId: data.challengeId, response })).data;
}

export async function fetchInvite(code: string): Promise<InviteInfo> {
  const response = await api.get<InviteInfo>(`/invites/${encodeURIComponent(code)}`, { validateStatus: (status) => status === 200 || status === 404 });
  if (response.status === 404) return { valid: false, reason: 'unknown', group: { name: '', logoUrl: null }, invitedBy: null, memberCount: 0, onlineCount: 0 };
  return response.data;
}

export async function registerWithInvite(code: string, name: string): Promise<SessionResult> {
  const path = `/invites/${encodeURIComponent(code)}/register`;
  const { data } = await api.post<Options>(`${path}/options`, { name });
  const response = await startRegistration({ optionsJSON: data.options });
  return (await api.post<SessionResult>(`${path}/verify`, { challengeId: data.challengeId, response })).data;
}

export async function registerWithInviteWithoutPasskey(code: string, name: string): Promise<SessionResult> {
  return (await api.post<SessionResult>(`/invites/${encodeURIComponent(code)}/register/no-passkey`, { name })).data;
}

export async function fetchRecovery(token: string): Promise<{ valid: boolean; name?: string }> {
  const response = await api.get<{ valid: boolean; name?: string }>(`/herstel/${encodeURIComponent(token)}`, { validateStatus: (status) => status === 200 || status === 404 });
  return response.status === 404 ? { valid: false } : response.data;
}

export async function recoverWithPasskey(token: string): Promise<SessionResult> {
  const path = `/herstel/${encodeURIComponent(token)}`;
  const { data } = await api.post<Options>(`${path}/register/options`);
  const response = await startRegistration({ optionsJSON: data.options });
  return (await api.post<SessionResult>(`${path}/register/verify`, { challengeId: data.challengeId, response })).data;
}

export async function recoverWithoutPasskey(token: string): Promise<SessionResult> {
  return (await api.post<SessionResult>(`/herstel/${encodeURIComponent(token)}/no-passkey`)).data;
}

/** Add a passkey to the logged-in account; resolves to the updated user. */
export async function addPasskey(authHeader: string): Promise<User> {
  const headers = { Authorization: authHeader };
  const { data } = await api.post<Options>('/account/passkeys/options', undefined, { headers });
  const response = await startRegistration({ optionsJSON: data.options });
  return (await api.post<{ user: User }>('/account/passkeys/verify', { challengeId: data.challengeId, response }, { headers })).data.user;
}

/** Revoke this browser's session on the server (best effort: logging out locally always works). */
export async function logoutSession(authHeader: string): Promise<void> {
  await api.post('/auth/logout', undefined, { headers: { Authorization: authHeader } }).catch(() => undefined);
}
```

`src/hooks/start-session.hook.ts`:
```ts
import useSignIn from 'react-auth-kit/hooks/useSignIn';
import type { SessionResult } from '@/lib/auth-api';

/** Store a fresh session (login, signup, herstel) in react-auth-kit. */
export function useStartSession() {
  const signIn = useSignIn();
  return (result: SessionResult) => signIn({ auth: { token: result.token, type: 'Bearer' }, userState: result.user });
}
```

`src/types/User.ts`:
```ts
import type { Vehicle } from './Tracker';

export interface User {
  _id: string;
  name: string;
  admin: boolean;
  /** Highest onboarding tour version seen; missing on sessions from before the tour existed (treat as 0) */
  tutorialVersion?: number;
  /** Number of passkeys on the account (0: logged in through a link only) */
  passkeyCount?: number;
  /** Only in admin user lists */
  lastActiveAt?: string | null;
  /** The user's own Traccar device ("Mijn tracker"); only in admin user lists */
  tracker?: { deviceId: number; uniqueId: string; vehicle: Vehicle };
}
```

- [ ] **Step 5: Run the test**

Run: `npx --yes bun test src/lib/passkey.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock src/lib/passkey.ts src/lib/passkey.test.ts src/lib/auth-api.ts src/hooks/start-session.hook.ts src/types/User.ts
git commit -m "feat(auth): passkey client api, error copy and session hook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
(Typecheck is broken until Task 10 removes the password UI.)

---

### Task 10: Remove the password UI; admin herstel-link

**Files:**
- Delete: `src/components/PasswordChangeGate.tsx`, `src/components/PasswordChangeForm.tsx`, `src/components/ResetPassword.tsx`, `src/lib/password-change.ts`, `src/lib/password-change.test.ts`, `src/lib/auth-result.ts`, `src/lib/auth-result.test.ts`
- Modify: `src/Routes.tsx`, `src/main.tsx`, `src/Layout.tsx`, `src/components/Settings.tsx`, `src/components/tour/useTour.ts`, `src/hooks/auth.hook.ts`, `src/hooks/logout.hook.ts`, `src/hooks/admin.hook.ts`, `src/components/admin/UsersPanel.tsx`, `src/components/admin/HuntersPanel.tsx`
- Create: `src/components/admin/RecoveryLinkDialog.tsx`

**Interfaces:**
- Consumes: `logoutSession` (T9).
- Produces: `useAuth()` returns only `{ updateUserState }`; `useAdmin()` loses `createUser`, gains `createRecoveryLink(id: string): Promise<{ url: string; expiresAt: string }>`.

- [ ] **Step 1: Delete files and unhook them**

```bash
git rm src/components/PasswordChangeGate.tsx src/components/PasswordChangeForm.tsx src/components/ResetPassword.tsx src/lib/password-change.ts src/lib/password-change.test.ts src/lib/auth-result.ts src/lib/auth-result.test.ts
```

`src/Routes.tsx`: remove the `PasswordChangeGate` import and its wrapping `<Route element={<PasswordChangeGate />}>…</Route>` (keep its children directly inside the `AuthOutlet` route). The new public routes come in Tasks 12–13.

`src/main.tsx`: remove the `installPasswordChangeInterceptor` import, its comment and its call.

`src/Layout.tsx`: remove the `isPasswordChangeRequired` import and the two lines
```tsx
        // Not an outage: PasswordChangeGate replaces the app with the password change screen
        if (isPasswordChangeRequired(error)) return;
```

`src/components/Settings.tsx`: remove the `ResetPassword` import, the `resetPasswordOpen` state, the `Wachtwoord wijzigen` `DropdownMenuItem`, the `<ResetPassword …/>` element, and `KeyIcon` from the lucide import if now unused.

`src/components/tour/useTour.ts` line 59: drop `&& !authUser.requiresPasswordChange`.

`src/hooks/auth.hook.ts` (whole file):
```ts
import { User } from '@/types/User';
import useSignIn from 'react-auth-kit/hooks/useSignIn';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';

export const useAuth = () => {
  const signIn = useSignIn();
  const authHeader = useAuthHeader();

  /** Replace the stored user (same token), e.g. after the tour or adding a passkey */
  async function updateUserState(user: User) {
    const token = authHeader ? authHeader.split(' ')[1] : '';
    signIn({ auth: { token, type: 'Bearer' }, userState: user });
  }

  return { updateUserState };
};
```

`src/hooks/logout.hook.ts`:
```ts
import useSignOut from 'react-auth-kit/hooks/useSignOut';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { useNavigate } from 'react-router';
import { useFetcher } from '@/hooks/utils/api.hook';
import { unsubscribePush } from '@/lib/push';
import { logoutSession } from '@/lib/auth-api';

/** Returns a logout function: drops this device's push subscription, ends the session, signs out and goes to the login page. */
export const useLogout = () => {
  const signOut = useSignOut();
  const navigate = useNavigate();
  const { fetch } = useFetcher();
  const authHeader = useAuthHeader();

  return async function logout() {
    await unsubscribePush(fetch);
    if (authHeader) await logoutSession(authHeader);
    signOut();
    navigate('/login');
  };
};
```

`src/hooks/admin.hook.ts`: delete `createUser` (function and return entry); add
```ts
  /** One-time herstel-link (1 hour) for a user who lost their passkey. Throws the axios error on failure. */
  async function createRecoveryLink(id: string): Promise<{ url: string; expiresAt: string }> {
    const { data } = await fetch<{ url: string; expiresAt: string }>(`/admin/users/${id}/recovery-link`, 'POST');
    return data;
  }
```
and return it.

`src/components/admin/HuntersPanel.tsx`: `subtitle` returns `row.user.name`; the facts row becomes `['Gebruiker', row.user ? row.user.name : '–']`; the search filter drops `|| row.user?.email.toLowerCase().includes(term)`.

- [ ] **Step 2: Admin herstel-link dialog**

`src/components/admin/RecoveryLinkDialog.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import CopyButton from '@/components/CopyButton';
import { apiErrorMessage } from '@/lib/api-error';
import type { User } from '@/types/User';

interface RecoveryLinkDialogProps {
  user: User | null;
  onClose: () => void;
  createLink: (id: string) => Promise<{ url: string; expiresAt: string }>;
}

/** Shows a fresh one-time herstel-link for `user` (made when the dialog opens). */
export default function RecoveryLinkDialog({ user, onClose, createLink }: RecoveryLinkDialogProps) {
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLink(null);
    setError(null);
    createLink(user._id)
      .then((result) => !cancelled && setLink(result))
      .catch((failure) => !cancelled && setError(apiErrorMessage(failure, 'Herstel-link maken is mislukt, probeer het opnieuw.')));
    return () => {
      cancelled = true;
    };
  }, [user, createLink]);

  const until = link ? new Date(link.expiresAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Herstel-link voor {user?.name}</DialogTitle>
          <DialogDescription>Hiermee maakt {user?.name} een nieuwe passkey en logt meteen in.</DialogDescription>
        </DialogHeader>
        {error && <p className="text-xs font-medium text-destructive">{error}</p>}
        {!error && !link && <Skeleton className="h-9 w-full" />}
        {link && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input readOnly value={link.url} className="font-mono text-xs" onFocus={(event) => event.target.select()} />
              <CopyButton value={link.url} label="Kopieer link" successMessage="Link gekopieerd" size="icon" />
            </div>
            <p className="text-xs text-muted-foreground">Geldig tot {until}, werkt één keer.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```
Before writing it, open `src/components/CopyButton.tsx` and `src/lib/api-error.ts` and adjust prop names / the `apiErrorMessage` signature if they differ from the usage above.

- [ ] **Step 3: Update UsersPanel**

In `src/components/admin/UsersPanel.tsx`:
- Remove `createUser` from the `useAdmin()` destructure; add `createRecoveryLink`.
- Search filter: `users?.filter((user: User) => user.name.toLowerCase().includes(searchTerm.toLowerCase())) || []`.
- Delete `handleCreate` and the `Nieuwe gebruiker` button.
- Replace the e-mail `TableHead`/`TableCell` (and its skeleton cell) by a passkeys column: header `Passkeys`, cell `{user.passkeyCount ?? 0}` with `className="max-md:hidden tabular-nums"`.
- In the actions cell, before the edit button, add:
```tsx
<Button variant="outline" size="icon" aria-label={`Herstel-link voor ${user.name}`} onClick={() => setRecoveryUser(user)}>
  <LifeBuoyIcon />
</Button>
```
(add `LifeBuoyIcon` to the lucide import and `const [recoveryUser, setRecoveryUser] = useState<User | null>(null);`).
- In the edit dialog remove the e-mail and password `Label`/`Input` rows; the title is always `Bewerk gebruiker`. `handleSave` only calls `updateUser(selectedUser)` (no create branch).
- Render `<RecoveryLinkDialog user={recoveryUser} onClose={() => setRecoveryUser(null)} createLink={createRecoveryLink} />` next to the other dialogs. Wrap `createRecoveryLink` in `useCallback` inside `useAdmin` (or pass `useCallback((id) => createRecoveryLink(id), [])` here) so the dialog's effect does not re-run every render.

- [ ] **Step 4: Typecheck, test, lint**

Run: `npx --yes bun x tsc -b && npx --yes bun test && npx --yes bun run lint`
Expected: no errors. Any remaining reference to `email`, `password`, `requiresPasswordChange` in `src/` is a bug: `grep -rn "requiresPasswordChange\|updatePassword\|PasswordChange\|user\.email\|\.password\b" src` must print nothing.

Note: `src/pages/Login.tsx` still calls the removed `login`; replace its body temporarily with `export default function Login() { return null; }` if the typecheck blocks this commit — Task 11 rewrites it.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(auth)!: remove password screens; herstel-link for admins

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: AuthScreen backdrop and the new login page (B, passkey half)

**Files:**
- Create: `src/components/auth/AuthScreen.tsx`
- Modify (rewrite): `src/pages/Login.tsx`

**Interfaces:**
- Consumes: `passkeyLogin`, `passkeysSupported` (T9); `classifyPasskeyError`, `PASSKEY_MESSAGES` (T9); `useStartSession` (T9).
- Produces: `<AuthScreen>{card}</AuthScreen>` — full-screen dimmed `background.webp`, card centered on `md+`, bottom-anchored on phones, credits footer underneath. Piece 2 adds the QR half to the login card.

- [ ] **Step 1: Backdrop component**

`src/components/auth/AuthScreen.tsx`:
```tsx
import type { ReactNode } from 'react';
import { GlobeIcon } from 'lucide-react';
import { siGithub } from 'simple-icons';
import backgroundImage from '@/assets/images/background.webp';
import { useTheme } from '@/hooks/theme.hook';

/** Login, invite and herstel pages: the photo fills the screen (dimmed), the card floats on top. */
export default function AuthScreen({ children }: { children: ReactNode }) {
  useTheme();
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-end p-4 md:justify-center md:p-10">
      <img src={backgroundImage} alt="" className="absolute inset-0 size-full object-cover brightness-[0.45] dark:brightness-[0.3] dark:grayscale" />
      <div className="relative flex w-full flex-col items-center gap-5">
        {children}
        {/* Haal onderstaande alsjeblieft niet weg! Zo help je andere ook een beetje :) */}
        <p className="text-center text-xs text-white/70 md:text-sm">
          Ontwikkeling door Silke Pilon ·{' '}
          <a href="https://silkepilon.dev" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
            <GlobeIcon className="size-3" />
            Website
          </a>{' '}
          ·{' '}
          <a href="https://github.com/SilkePilon" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
            <span className="size-3 fill-white/70" dangerouslySetInnerHTML={{ __html: siGithub.svg }} />
            GitHub
          </a>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Login page**

`src/pages/Login.tsx` (whole file):
```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { KeyRoundIcon, Loader2Icon } from 'lucide-react';
import usePWA from 'react-pwa-install-prompt';
import { isMobile } from 'react-device-detect';
import { Button } from '@/components/ui/button';
import AuthScreen from '@/components/auth/AuthScreen';
import { passkeyLogin, passkeysSupported } from '@/lib/auth-api';
import { classifyPasskeyError, PASSKEY_MESSAGES } from '@/lib/passkey';
import { useStartSession } from '@/hooks/start-session.hook';

export default function Login() {
  const navigate = useNavigate();
  const startSession = useStartSession();
  const { isStandalone, isInstallPromptSupported, promptInstall } = usePWA();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(passkeysSupported() ? null : PASSKEY_MESSAGES.unsupported);

  async function handleLogin() {
    setBusy(true);
    setError(null);
    try {
      if (!startSession(await passkeyLogin())) throw new Error('Sign-in failed');
      navigate('/');
      if (isInstallPromptSupported && !isStandalone && isMobile) promptInstall();
    } catch (failure) {
      setError(PASSKEY_MESSAGES[classifyPasskeyError(failure)]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScreen>
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-card-foreground shadow-lg md:p-8">
        <div className="flex flex-col gap-5">
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
      </div>
    </AuthScreen>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx --yes bun x tsc -b && npx --yes bun run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/auth/AuthScreen.tsx src/pages/Login.tsx
git commit -m "feat(auth): passkey login page on the photo backdrop

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Invite page (C) with welcome card

**Files:**
- Create: `src/components/auth/WelcomeCard.tsx`, `src/pages/Invite.tsx`
- Modify: `src/Routes.tsx`

**Interfaces:**
- Consumes: `fetchInvite`, `registerWithInvite`, `registerWithInviteWithoutPasskey`, `passkeysSupported` (T9); `INVITE_REASON_TEXT`, `classifyPasskeyError`, `PASSKEY_MESSAGES` (T9); `useStartSession` (T9); `AuthScreen` (T11); `CookieBadge` (`src/components/tracker/CookieBadge.tsx`, props `tone`, `size`).
- Produces: `<WelcomeCard name withPasskey />`; route `/invite/:code`.

- [ ] **Step 1: Welcome card**

`src/components/auth/WelcomeCard.tsx`:
```tsx
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import CookieBadge from '@/components/tracker/CookieBadge';

/** After signup or herstel: the same green cookie check as "Mijn tracker". */
export default function WelcomeCard({ name, withPasskey }: { name: string; withPasskey: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border bg-card p-7 text-center text-card-foreground shadow-lg">
      <CookieBadge tone="ok" size={72} />
      <h2 className="mt-2 text-lg font-semibold">Welkom, {name}!</h2>
      <p className="text-sm text-muted-foreground">
        {withPasskey ? 'Je account en passkey zijn klaar. Volgende keer log je in met één tik.' : 'Je account is klaar. Voeg later een passkey toe om sneller in te loggen.'}
      </p>
      <Button className="mt-1 w-full" onClick={() => navigate('/')}>
        Naar de kaart
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Invite page**

`src/pages/Invite.tsx`:
```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { KeyRoundIcon, Link2OffIcon, Loader2Icon, UsersIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import AuthScreen from '@/components/auth/AuthScreen';
import WelcomeCard from '@/components/auth/WelcomeCard';
import { fetchInvite, passkeysSupported, registerWithInvite, registerWithInviteWithoutPasskey, type InviteInfo } from '@/lib/auth-api';
import { classifyPasskeyError, INVITE_REASON_TEXT, PASSKEY_MESSAGES } from '@/lib/passkey';
import { useStartSession } from '@/hooks/start-session.hook';

const FALLBACK_LOGO = import.meta.env.LOGO_URL || '/logo.svg';

function GroupLogo({ url, className }: { url: string | null; className: string }) {
  return <img src={url ?? FALLBACK_LOGO} alt="" className={`${className} rounded-2xl object-cover ring-1 ring-border`} onError={(event) => (event.currentTarget.src = FALLBACK_LOGO)} />;
}

function InvalidCard({ text }: { text: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border bg-card p-7 text-center shadow-lg">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
        <Link2OffIcon className="size-5 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-medium tracking-tight">Deze uitnodiging werkt niet meer</h2>
      <p className="text-sm/relaxed text-muted-foreground">{text}</p>
      <Button variant="outline" className="mt-1 w-full" onClick={() => navigate('/login')}>
        Naar inloggen
      </Button>
    </div>
  );
}

export default function Invite() {
  const { code = '' } = useParams();
  const startSession = useStartSession();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [done, setDone] = useState<{ name: string; withPasskey: boolean } | null>(null);
  const supported = passkeysSupported();

  useEffect(() => {
    fetchInvite(code)
      .then(setInvite)
      .catch((failure) => setLoadError(PASSKEY_MESSAGES[classifyPasskeyError(failure)]));
  }, [code]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Vul je naam in.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = supported ? await registerWithInvite(code, trimmed) : await registerWithInviteWithoutPasskey(code, trimmed);
      startSession(result);
      setDone({ name: result.user.name, withPasskey: (result.user.passkeyCount ?? 0) > 0 });
    } catch (failure) {
      const kind = classifyPasskeyError(failure);
      if (kind === 'invite-gone') setGone(true);
      else setError(PASSKEY_MESSAGES[kind]);
    } finally {
      setBusy(false);
    }
  }

  if (done) return <AuthScreen><WelcomeCard name={done.name} withPasskey={done.withPasskey} /></AuthScreen>;
  if (loadError) return <AuthScreen><InvalidCard text={loadError} /></AuthScreen>;
  if (!invite) return <AuthScreen><Skeleton className="h-72 w-full max-w-[760px] rounded-xl" /></AuthScreen>;
  if (!invite.valid || gone) return <AuthScreen><InvalidCard text={INVITE_REASON_TEXT[invite.reason ?? 'unknown']} /></AuthScreen>;

  const counts = `${invite.memberCount} ${invite.memberCount === 1 ? 'lid' : 'leden'} · ${invite.onlineCount} online`;

  return (
    <AuthScreen>
      <div className="w-full max-w-[760px] overflow-hidden rounded-xl border bg-card text-card-foreground shadow-lg md:grid md:grid-cols-[1fr_auto_1fr]">
        {/* Phone: compact header row; desktop: big left half */}
        <div className="flex items-center gap-3 border-b p-5 md:flex-col md:justify-center md:gap-4 md:border-b-0 md:p-8 md:text-center">
          <GroupLogo url={invite.group.logoUrl} className="size-11 md:size-20" />
          <div>
            <p className="text-xs text-muted-foreground md:text-sm">{invite.invitedBy ? `${invite.invitedBy} nodigt je uit voor` : 'Je bent uitgenodigd voor'}</p>
            <h1 className="text-lg font-bold leading-tight md:text-2xl">{invite.group.name}</h1>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground md:mt-1 md:justify-center">
              <UsersIcon className="hidden size-3.5 md:block" />
              {counts}
            </p>
          </div>
        </div>
        <div className="my-8 hidden w-px bg-border md:block" />
        <form className="flex flex-col justify-center gap-4 p-5 md:p-8" onSubmit={handleSubmit}>
          <div className="hidden md:block">
            <h2 className="text-lg font-semibold">Maak je account</h2>
            <p className="text-sm text-muted-foreground">Kost 10 seconden.</p>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="invite-name" className="text-sm font-medium">
              Hoe heet je?
            </label>
            <Input id="invite-name" value={name} maxLength={40} autoComplete="nickname" placeholder="Je naam" onChange={(event) => setName(event.target.value)} />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? <Loader2Icon className="animate-spin" /> : supported && <KeyRoundIcon />}
            {supported ? 'Account maken met passkey' : 'Account maken'}
          </Button>
          {error && (
            <p role="alert" className="text-xs font-medium text-destructive">
              {error}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {supported ? 'Je apparaat vraagt om je vingerafdruk, gezicht of schermvergrendeling.' : 'Deze browser ondersteunt geen passkeys; je kunt er later een toevoegen.'}
          </p>
        </form>
      </div>
    </AuthScreen>
  );
}
```

- [ ] **Step 3: Route**

`src/Routes.tsx`: `const Invite = lazy(() => import('./pages/Invite'));` and next to `/login`: `<Route path="/invite/:code" element={<Invite />} />`.

- [ ] **Step 4: Typecheck and lint**

Run: `npx --yes bun x tsc -b && npx --yes bun run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/WelcomeCard.tsx src/pages/Invite.tsx src/Routes.tsx
git commit -m "feat(auth): invite page with group logo, passkey signup and welcome card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Herstel page and the add-passkey prompt

**Files:**
- Create: `src/pages/Herstel.tsx`, `src/components/AddPasskeyPrompt.tsx`
- Modify: `src/Routes.tsx`, `src/Layout.tsx`

**Interfaces:**
- Consumes: `fetchRecovery`, `recoverWithPasskey`, `recoverWithoutPasskey`, `addPasskey`, `passkeysSupported` (T9); `WelcomeCard`, `AuthScreen` (T11–12); `useAuth().updateUserState` (T10).
- Produces: route `/herstel/:token`; `<AddPasskeyPrompt />` mounted in `Layout`.

- [ ] **Step 1: Herstel page**

`src/pages/Herstel.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { KeyRoundIcon, Link2OffIcon, Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AuthScreen from '@/components/auth/AuthScreen';
import WelcomeCard from '@/components/auth/WelcomeCard';
import { fetchRecovery, passkeysSupported, recoverWithoutPasskey, recoverWithPasskey } from '@/lib/auth-api';
import { classifyPasskeyError, PASSKEY_MESSAGES } from '@/lib/passkey';
import { useStartSession } from '@/hooks/start-session.hook';

export default function Herstel() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const startSession = useStartSession();
  const [state, setState] = useState<{ valid: boolean; name?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; withPasskey: boolean } | null>(null);
  const supported = passkeysSupported();

  useEffect(() => {
    fetchRecovery(token)
      .then(setState)
      .catch(() => setState({ valid: false }));
  }, [token]);

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      const result = supported ? await recoverWithPasskey(token) : await recoverWithoutPasskey(token);
      startSession(result);
      setDone({ name: result.user.name, withPasskey: supported });
    } catch (failure) {
      const kind = classifyPasskeyError(failure);
      if (kind === 'link-gone') setState({ valid: false });
      else setError(PASSKEY_MESSAGES[kind]);
    } finally {
      setBusy(false);
    }
  }

  if (done) return <AuthScreen><WelcomeCard name={done.name} withPasskey={done.withPasskey} /></AuthScreen>;
  if (!state) return <AuthScreen><Skeleton className="h-60 w-full max-w-sm rounded-xl" /></AuthScreen>;

  if (!state.valid) {
    return (
      <AuthScreen>
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border bg-card p-7 text-center shadow-lg">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <Link2OffIcon className="size-5 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium tracking-tight">Deze herstel-link werkt niet meer</h2>
          <p className="text-sm/relaxed text-muted-foreground">De link is verlopen of al gebruikt. Vraag de organisatie om een nieuwe.</p>
          <Button variant="outline" className="mt-1 w-full" onClick={() => navigate('/login')}>
            Naar inloggen
          </Button>
        </div>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border bg-card p-6 text-card-foreground shadow-lg md:p-8">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="" className="size-10" />
          <div>
            <h1 className="text-xl font-bold leading-tight">Hoi {state.name}!</h1>
            <p className="text-sm text-muted-foreground">{supported ? 'Maak een nieuwe passkey' : 'Log in op dit apparaat'}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {supported ? 'Je apparaat vraagt om je vingerafdruk, gezicht of schermvergrendeling. Daarna ben je ingelogd.' : 'Deze browser ondersteunt geen passkeys. Je wordt ingelogd zonder passkey.'}
        </p>
        <Button size="lg" className="w-full" onClick={handleClick} disabled={busy}>
          {busy ? <Loader2Icon className="animate-spin" /> : supported && <KeyRoundIcon />}
          {supported ? 'Passkey maken' : 'Inloggen'}
        </Button>
        {error && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
    </AuthScreen>
  );
}
```

`src/Routes.tsx`: `const Herstel = lazy(() => import('./pages/Herstel'));` and `<Route path="/herstel/:token" element={<Herstel />} />` next to `/invite/:code`.

- [ ] **Step 2: Add-passkey prompt**

`src/components/AddPasskeyPrompt.tsx`:
```tsx
import { useEffect } from 'react';
import { toast } from 'sonner';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { addPasskey, passkeysSupported } from '@/lib/auth-api';
import { classifyPasskeyError, PASSKEY_MESSAGES } from '@/lib/passkey';
import { useAuth } from '@/hooks/auth.hook';
import type { User } from '@/types/User';

const TOAST_ID = 'add-passkey';
const DISMISSED_KEY = 'add-passkey-dismissed';

/** Users without a passkey (signed up or recovered on a browser without one) get one nudge per browser session. */
export default function AddPasskeyPrompt() {
  const user = useAuthUser<User>();
  const authHeader = useAuthHeader();
  const { updateUserState } = useAuth();
  const needsPasskey = !!user && (user.passkeyCount ?? 0) === 0;

  useEffect(() => {
    if (!needsPasskey || !authHeader || !passkeysSupported() || sessionStorage.getItem(DISMISSED_KEY)) return;
    toast('Voeg een passkey toe', {
      id: TOAST_ID,
      duration: Infinity,
      description: 'Dan log je voortaan in met je vingerafdruk of gezicht.',
      action: {
        label: 'Toevoegen',
        onClick: async () => {
          try {
            await updateUserState(await addPasskey(authHeader));
            toast.success('Passkey toegevoegd');
          } catch (failure) {
            toast.error(PASSKEY_MESSAGES[classifyPasskeyError(failure)]);
          }
        },
      },
      onDismiss: () => sessionStorage.setItem(DISMISSED_KEY, '1'),
    });
  }, [needsPasskey, authHeader, updateUserState]);

  return null;
}
```

`src/Layout.tsx`: import `AddPasskeyPrompt from './components/AddPasskeyPrompt'` and render `<AddPasskeyPrompt/>` inside the first `ErrorBoundary variant="floating"` next to `<DemoReloader/>`.

- [ ] **Step 3: Typecheck, lint, test**

Run: `npx --yes bun x tsc -b && npx --yes bun run lint && npx --yes bun test`
Expected: clean / PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Herstel.tsx src/components/AddPasskeyPrompt.tsx src/Routes.tsx src/Layout.tsx
git commit -m "feat(auth): herstel page and a nudge to add a passkey

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: End-to-end check with real passkeys (manual)

**Files:** none (verification only).

- [ ] **Step 1: Start a throwaway server** (server worktree; leave the live docker stack alone)

```bash
cd "/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-server-passwordless"
export PORT=3101 MONGO_URI=mongodb://localhost:27017/jotihunt-passkey-smoke JWT_SECRET=smoke-secret-smoke-secret-smoke-secret \
  WEBAUTHN_RP_ID=localhost WEBAUTHN_ORIGINS=http://localhost:5191 PUBLIC_APP_URL=http://localhost:5191 \
  JOTIHUNT_API_URL=http://127.0.0.1:9 JOTIHUNT_WEB_URL=http://127.0.0.1:9 TRACCAR_API_URL=http://127.0.0.1:9
nohup npx --yes bun run src/index.ts > /tmp/jh-passkey-server.log 2>&1 &
echo $!
```
Record the PID.

- [ ] **Step 2: Start the client** (client worktree)

```bash
cd "/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client-passwordless"
API_BASE_URL=http://localhost:3101 nohup npx --yes bun x vite --port 5191 > /tmp/jh-passkey-client.log 2>&1 &
echo $!
```

- [ ] **Step 3: Walk the flows in a desktop Chrome or Firefox with a platform authenticator (or Chrome DevTools → WebAuthn → virtual authenticator)**

1. `npx --yes bun run login-link -- --new Silke --admin` (server worktree, same env) → open the link → **Passkey maken** → WelcomeCard → **Naar de kaart** shows the map.
2. Log out (gear menu) → `/login` → **Inloggen met passkey** → map.
3. Create an invite: `curl -s -X POST localhost:3101/admin/invites -H "Authorization: Bearer <token from the _auth cookie>" -H 'Content-Type: application/json' -d '{"expiry":"1d","maxUses":1}'` → open the `url` in a private window → name + **Account maken met passkey** → welcome. Open the same link again → "Deze uitnodiging werkt niet meer" with the "al te vaak gebruikt" text.
4. Admin: gear → Admin tools → Gebruikers → life-buoy button on a user → herstel-link dialog with copy.
5. Cancel the passkey prompt on `/login` → "Niet afgerond. Probeer het opnieuw."

Expected: every step behaves as described; `/tmp/jh-passkey-server.log` shows no errors besides cron connection refusals.

- [ ] **Step 4: Stop and clean up**

```bash
kill <server pid> <client pid>
docker exec jotihunt-mongodb-1 mongosh --quiet --eval 'db.getSiblingDB("jotihunt-passkey-smoke").dropDatabase()'
```

- [ ] **Step 5: Note the deploy steps for the user (no commit)**

When deploying piece 1: set `WEBAUTHN_RP_ID=jotihunt.silkepilon.dev`, `WEBAUTHN_ORIGINS=https://jotihunt.silkepilon.dev`, `PUBLIC_APP_URL=https://jotihunt.silkepilon.dev`, `HOME_TEAM_API_ID`, `GROUP_NAME` in the homelab server manifest; deploy server + client together; run `bun run migrate-passwordless` once, then `bun run login-link -- --user Silke` in the server pod.
