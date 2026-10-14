# Huntbare vossen (huntable areas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show team-wide which fox teams we may **not** hunt (rule 5.1): a server setting with the allowed areas, a pure client rule, a dimmed+locked chip and hatched bar segment in the Vossen card, and grey lock-badged map markers.

**Architecture:** The server stores `{ areas: string[] }` in the REAL database `settings` collection (key `huntable-areas`), cached in memory like `prediction-setting.ts`, served at `GET/PUT /settings/huntable-areas`. The client polls it with SWR in `useHuntableAreas()`, combines it with our own area (home team from `/teams`) through the pure `isForbiddenArea()`, and feeds `isForbidden(area)` into the Vossen card and the fox/prediction map features (a `locked` flag in the marker image id).

**Tech Stack:** Server: Bun, Express, express-validator, Mongoose, `bun:test`. Client: React 19, TypeScript, SWR, Tailwind 4, motion/react, lucide-react, MapLibre (react-map-gl), `bun:test`.

**Spec:** `docs/superpowers/specs/2026-10-14-huntable-areas-design.md` (client repo).

## Global Constraints

- Setting value `{ areas: string[] | null }`: lowercase area names (`alpha` … `oscar`) allowed besides our own area; `null` (no document) = not configured = every fox allowed.
- Stored in the REAL database `settings` collection (also in demo mode), cached in memory — same pattern as `src/settings/prediction-setting.ts`.
- `GET /settings/huntable-areas` (verifyToken) → `{ areas }`; `PUT /settings/huntable-areas` (verifyToken + isAdmin) body `{ areas: string[] }`, each entry one of the 9 area names (express-validator, Dutch message), duplicates removed, stored sorted, logs who changed it.
- Own (hoofd) fox team = `area` of our home team (`/teams`), never a setting; it is never forbidden.
- `isForbiddenArea(area: string, ownArea: string | undefined, allowed: string[] | null | undefined): boolean` — null/undefined → false; own area (case-insensitive) → false; else `!allowed.includes(area.toLowerCase())`.
- Hook `useHuntableAreas()` in `src/hooks/huntable-areas.hook.ts` → `{ allowed, setAllowed, isForbidden(area) }`; `setAllowed` is for the (later) Beheer card.
- Vossen card option A: forbidden chip dimmed ≈45 %, lock icon instead of the area dot (POP swap from `lib/motion`), the stronger dim wins with map-hidden (hidden = 40 %); bar segment dimmed + hatched in full and mini bar; tooltip/aria-label adds `· niet toegestaan voor onze groep (0 punten)`; counts and grouping unchanged.
- Map M6: spot, hunt (and unknown-type) fox markers and prediction pins of a forbidden area: `surfaceContainerHighest` fill, `onSurfaceVariant` glyph, ~80 % opacity, lock badge instead of the area letter; id suffix `|locked` (e.g. `fox|spot|green|alpha|locked`); map images swap without animation.
- Out of scope: Beheer → Algemeen card UI (separate Beheer redesign plan), hint labels, group (house) pins, HQ screen, hunt registration warnings.
- Every UI state change animates (motion/react, `src/lib/motion.ts`).
- Server work ONLY in a new worktree from `origin/main`; never touch `/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-server` (its checkout belongs to another session).
- Client work on branch `feat/huntable-areas` from local `main` in `/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client`.
- `bun` is not on PATH: use `npx --yes bun ...`. Server tests need the docker MongoDB on `localhost:27017` (`jotihunt-test` DB). Don't `pkill -f`; kill by PID. Never restart the docker stack (live instance).
- Every commit message ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.

## File Structure

Server (worktree `/home/silke/Documents/Jotihunt 2026/.worktrees/server-huntable`, branch `feat/huntable-areas`):

| File | Change | Responsibility |
|---|---|---|
| `src/demo/demo-state.ts` | modify | `HuntableAreasSettingDoc` schema + `readHuntableAreas` / `writeHuntableAreas` on the real-DB store |
| `src/settings/huntable-areas-setting.ts` | create | cached setting: `initHuntableAreas`, `getHuntableAreas`, `setHuntableAreas`, `normalizeAreas`, `resetHuntableAreas` |
| `src/settings/huntable-areas-setting.test.ts` | create | store + cache tests |
| `src/settings/huntable-areas.validation.ts` | create | express-validator chain for the PUT body |
| `src/settings/settings.controller.ts` | modify | `getHuntableAreasSetting`, `putHuntableAreasSetting` |
| `src/settings/huntable-areas.route.test.ts` | create | validation + controller tests |
| `src/routes/settings.route.ts` | modify | the two routes |
| `src/index.ts` | modify | `await initHuntableAreas(getDemoStateStore())` |

Client (branch `feat/huntable-areas`):

| File | Change | Responsibility |
|---|---|---|
| `src/lib/huntable-areas.ts` | create | pure `isForbiddenArea`, `FORBIDDEN_AREA_NOTE`, `HuntableAreasSetting` type |
| `src/lib/huntable-areas.test.ts` | create | rule tests |
| `src/lib/response-shape.ts` (+ `.test.ts`) | modify | shape check for `/settings/huntable-areas` |
| `src/hooks/huntable-areas.hook.ts` | create | `useHuntableAreas()` |
| `src/components/sidebar/foxes/FoxChip.tsx` | modify | dim + lock/dot POP swap + tooltip suffix |
| `src/components/sidebar/foxes/FoxStatusBar.tsx` | modify | dimmed + hatched forbidden segment |
| `src/components/sidebar/foxes/FoxesCard.tsx` | modify | wire `isForbidden` into chips and both bars |
| `src/lib/marker-style.ts` (+ `.test.ts`) | modify | `locked` in fox/prediction keys, id suffix, parsing, `lock` glyph name |
| `src/lib/map-layers.ts` (+ `.test.ts`) | modify | `isForbidden` in `markerFeatures` / `predictionPinFeatures` |
| `src/components/layers/marker-glyphs.ts` | modify | `lock` Material Symbol path |
| `src/components/layers/marker-icons.ts` | modify | neutral roles + lock badge + 80 % alpha for locked keys |
| `src/components/layers/Markers.tsx`, `Predictions.tsx` | modify | pass `isForbidden` |

---

### Task 1: Server setting store and cache

**Files:**
- Modify: `src/demo/demo-state.ts`
- Create: `src/settings/huntable-areas-setting.ts`
- Test: `src/settings/huntable-areas-setting.test.ts`

(All paths relative to the server worktree `/home/silke/Documents/Jotihunt 2026/.worktrees/server-huntable`.)

**Interfaces:**
- Consumes: `AREAS`, `AreaName` from `src/constants/areas.ts` (existing, alphabetical: alpha … hotel, oscar); `openDemoStateStore(uri)` / `DemoStateStore` from `src/demo/demo-state.ts`.
- Produces:
  - `interface HuntableAreasSettingDoc { key: string; areas: string[]; updatedAt?: Date | null; updatedBy?: string | null }` (demo-state.ts)
  - `DemoStateStore.readHuntableAreas(): Promise<HuntableAreasSettingDoc | null>`; `DemoStateStore.writeHuntableAreas(setting: Omit<HuntableAreasSettingDoc, "key">): Promise<void>`
  - `interface HuntableAreasStore { readHuntableAreas; writeHuntableAreas }` (same signatures)
  - `normalizeAreas(list: readonly string[]): AreaName[]`
  - `initHuntableAreas(store: HuntableAreasStore): Promise<AreaName[] | null>`
  - `getHuntableAreas(): AreaName[] | null`
  - `setHuntableAreas(list: readonly string[], updatedBy: string | null): Promise<AreaName[]>` (throws when not initialised or the write fails; cache unchanged then)
  - `resetHuntableAreas(): void` (tests only)

- [ ] **Step 1: Create the server worktree (never touch the main checkout)**

```bash
cd "/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-server"
git fetch origin
git worktree add ../.worktrees/server-huntable -b feat/huntable-areas origin/main
cd "/home/silke/Documents/Jotihunt 2026/.worktrees/server-huntable"
npx --yes bun install
docker ps --filter name=jotihunt-mongodb-1 --format '{{.Names}} {{.Status}}'
```

Expected: worktree created on `feat/huntable-areas`, install finishes, the Mongo container is `Up`. From here on every server command runs in `/home/silke/Documents/Jotihunt 2026/.worktrees/server-huntable`.

- [ ] **Step 2: Write the failing test**

Create `src/settings/huntable-areas-setting.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { openDemoStateStore, type DemoStateStore } from "../demo/demo-state";
import { getHuntableAreas, initHuntableAreas, normalizeAreas, resetHuntableAreas, setHuntableAreas, type HuntableAreasStore } from "./huntable-areas-setting";

const uri = process.env.MONGO_URI_TEST ?? "mongodb://localhost:27017/jotihunt-test";
let store: DemoStateStore;

beforeAll(async () => {
  store = await openDemoStateStore(uri);
});
beforeEach(async () => {
  await store.connection.collection("settings").deleteMany({});
  resetHuntableAreas();
});
afterAll(async () => {
  await store.connection.collection("settings").deleteMany({});
  await store.close();
});

describe("normalizeAreas", () => {
  test("known areas only, without duplicates, sorted", () => {
    expect(normalizeAreas(["oscar", "bravo", "bravo", "alpha"])).toEqual(["alpha", "bravo", "oscar"]);
    expect(normalizeAreas(["zulu", "Bravo"])).toEqual([]);
    expect(normalizeAreas([])).toEqual([]);
  });
});

describe("huntable areas setting store and cache", () => {
  test("defaults to null (not configured) without a document", async () => {
    expect(await initHuntableAreas(store)).toBeNull();
    expect(getHuntableAreas()).toBeNull();
  });

  test("write persists in the settings collection, then caches", async () => {
    await initHuntableAreas(store);
    expect(await setHuntableAreas(["delta", "bravo", "delta"], "Sanne")).toEqual(["bravo", "delta"]);
    expect(getHuntableAreas()).toEqual(["bravo", "delta"]);
    const doc = await store.connection.collection("settings").findOne({ key: "huntable-areas" });
    expect(doc).toMatchObject({ key: "huntable-areas", areas: ["bravo", "delta"], updatedBy: "Sanne" });
    expect(doc?.updatedAt).toBeInstanceOf(Date);
    // A restart reads the saved value; the cache is not re-read on every call
    resetHuntableAreas();
    expect(await initHuntableAreas(store)).toEqual(["bravo", "delta"]);
    await store.connection.collection("settings").updateOne({ key: "huntable-areas" }, { $set: { areas: ["echo"] } });
    expect(getHuntableAreas()).toEqual(["bravo", "delta"]);
  });

  test("an empty list is configured (every other area forbidden), not null", async () => {
    await initHuntableAreas(store);
    expect(await setHuntableAreas([], null)).toEqual([]);
    resetHuntableAreas();
    expect(await initHuntableAreas(store)).toEqual([]);
  });

  test("does not touch the demo or prediction documents", async () => {
    await store.write({ enabled: true, enabledAt: null, enabledBy: null, startedAt: null });
    await store.writePrediction({ enabled: false, updatedAt: null, updatedBy: null });
    await initHuntableAreas(store);
    await setHuntableAreas(["alpha"], null);
    expect((await store.read())?.enabled).toBe(true);
    expect((await store.readPrediction())?.enabled).toBe(false);
  });

  test("a failed write leaves the cache unchanged", async () => {
    const failing: HuntableAreasStore = {
      readHuntableAreas: async () => ({ key: "huntable-areas", areas: ["bravo"] }),
      writeHuntableAreas: async () => {
        throw new Error("database down");
      },
    };
    await initHuntableAreas(failing);
    await expect(setHuntableAreas(["charlie"], null)).rejects.toThrow("database down");
    expect(getHuntableAreas()).toEqual(["bravo"]);
  });

  test("writing without init throws", async () => {
    await expect(setHuntableAreas(["alpha"], null)).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx --yes bun test src/settings/huntable-areas-setting.test.ts`
Expected: FAIL — `Cannot find module './huntable-areas-setting'`.

- [ ] **Step 4: Add the document to the real-DB store**

In `src/demo/demo-state.ts`, below `const PREDICTION_KEY = "prediction";` add:

```ts
/** Fox teams we may hunt besides our own (rule 5.1); one document (key "huntable-areas") in the same `settings` collection. */
export interface HuntableAreasSettingDoc {
  key: string;
  /** Lowercase area names, sorted, without duplicates */
  areas: string[];
  updatedAt?: Date | null;
  updatedBy?: string | null;
}

const HuntableAreasSettingSchema = new mongoose.Schema<HuntableAreasSettingDoc>(
  {
    key: { type: String, required: true, unique: true },
    areas: { type: [String], required: true, default: [] },
    updatedAt: { type: Date, default: null },
    updatedBy: { type: String, default: null },
  },
  { collection: "settings", versionKey: false },
);

const HUNTABLE_AREAS_KEY = "huntable-areas";
```

In `interface DemoStateStore`, after `writePrediction(...)`:

```ts
  readHuntableAreas(): Promise<HuntableAreasSettingDoc | null>;
  writeHuntableAreas(setting: Omit<HuntableAreasSettingDoc, "key">): Promise<void>;
```

In `openDemoStateStore`, after the `PredictionSetting` model line:

```ts
  const HuntableAreasSetting: Model<HuntableAreasSettingDoc> = connection.model<HuntableAreasSettingDoc>("HuntableAreasSetting", HuntableAreasSettingSchema);
```

and in the returned object, after `writePrediction`:

```ts
    async readHuntableAreas() {
      return HuntableAreasSetting.findOne({ key: HUNTABLE_AREAS_KEY }).lean<HuntableAreasSettingDoc>();
    },
    async writeHuntableAreas(setting) {
      await HuntableAreasSetting.updateOne({ key: HUNTABLE_AREAS_KEY }, { $set: { ...setting, key: HUNTABLE_AREAS_KEY } }, { upsert: true });
    },
```

- [ ] **Step 5: Write the setting module**

Create `src/settings/huntable-areas-setting.ts`:

```ts
import { AREAS, type AreaName } from "../constants/areas";
import type { HuntableAreasSettingDoc } from "../demo/demo-state";

/** The part of the demo state store this module needs (the `settings` collection of the REAL database). */
export interface HuntableAreasStore {
  readHuntableAreas(): Promise<HuntableAreasSettingDoc | null>;
  writeHuntableAreas(setting: Omit<HuntableAreasSettingDoc, "key">): Promise<void>;
}

/** Cached list: read at startup, updated on write. Null (no document) means not configured: every fox may be hunted. */
let areas: AreaName[] | null = null;
let store: HuntableAreasStore | null = null;

/** Known areas only, without duplicates, sorted (AREAS is alphabetical). */
export function normalizeAreas(list: readonly string[]): AreaName[] {
  return AREAS.filter((area) => list.includes(area));
}

export async function initHuntableAreas(settingStore: HuntableAreasStore): Promise<AreaName[] | null> {
  store = settingStore;
  const doc = await settingStore.readHuntableAreas();
  areas = doc ? normalizeAreas(doc.areas ?? []) : null;
  return areas;
}

/** Areas we may hunt besides our own; null when an admin never set them. */
export function getHuntableAreas(): AreaName[] | null {
  return areas;
}

/** Persist first, then update the cache (so a failed write leaves both unchanged). */
export async function setHuntableAreas(list: readonly string[], updatedBy: string | null): Promise<AreaName[]> {
  if (!store) throw new Error("Huntable areas setting is not initialised");
  const next = normalizeAreas(list);
  await store.writeHuntableAreas({ areas: next, updatedAt: new Date(), updatedBy });
  areas = next;
  return next;
}

/** Tests only */
export function resetHuntableAreas() {
  store = null;
  areas = null;
}
```

- [ ] **Step 6: Run the tests and typecheck**

Run: `npx --yes bun test src/settings/huntable-areas-setting.test.ts src/settings/prediction-setting.test.ts`
Expected: PASS (all tests in both files).
Run: `npx --yes bun x tsc --noEmit`
Expected: no output, exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/demo/demo-state.ts src/settings/huntable-areas-setting.ts src/settings/huntable-areas-setting.test.ts
git commit -m "feat(settings): huntable areas setting in the real database

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Server route, validation and startup init

**Files:**
- Create: `src/settings/huntable-areas.validation.ts`
- Modify: `src/settings/settings.controller.ts`
- Modify: `src/routes/settings.route.ts`
- Modify: `src/index.ts:8,67`
- Test: `src/settings/huntable-areas.route.test.ts`

**Interfaces:**
- Consumes: from Task 1 `initHuntableAreas`, `getHuntableAreas`, `setHuntableAreas`, `resetHuntableAreas`; existing `validate(validations: ContextRunner[])` from `src/middleware/validate.middleware.ts` (400 `{ errors: [{ msg, path, ... }] }`); `verifyToken`, `isAdmin`.
- Produces:
  - `huntableAreasValidation: ValidationChain[]`
  - `getHuntableAreasSetting(req, res)` → 200 `{ areas: string[] | null }`
  - `putHuntableAreasSetting(req, res)` → 200 `{ areas: string[] }`, logs `Huntable areas set to <list|(none)> by <name>`
  - HTTP: `GET /settings/huntable-areas`, `PUT /settings/huntable-areas` (client relies on these exact paths and shapes)

- [ ] **Step 1: Write the failing test**

Create `src/settings/huntable-areas.route.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Request, Response } from "express";
import { openDemoStateStore, type DemoStateStore } from "../demo/demo-state";
import { validate } from "../middleware/validate.middleware";
import { initHuntableAreas, resetHuntableAreas } from "./huntable-areas-setting";
import { huntableAreasValidation } from "./huntable-areas.validation";

// The controller imports the logger from the app entry point, which would start the server
const infoLogs: string[] = [];
mock.module("../logger", () => ({ logger: { info: (message: string) => infoLogs.push(message), error() {}, warn() {}, debug() {} } }));
const { getHuntableAreasSetting, putHuntableAreasSetting } = await import("./settings.controller");

const uri = process.env.MONGO_URI_TEST ?? "mongodb://localhost:27017/jotihunt-test";
let store: DemoStateStore;

beforeAll(async () => {
  store = await openDemoStateStore(uri);
});
beforeEach(async () => {
  await store.connection.collection("settings").deleteMany({});
  resetHuntableAreas();
  infoLogs.length = 0;
});
afterAll(async () => {
  await store.connection.collection("settings").deleteMany({});
  await store.close();
});

function fakeRes() {
  const res = { statusCode: 0, body: undefined as unknown } as { statusCode: number; body: unknown; status(code: number): typeof res; json(body: unknown): typeof res };
  res.status = (code) => ((res.statusCode = code), res);
  res.json = (body) => ((res.body = body), res);
  return res;
}
const call = async (handler: (req: Request, res: Response) => unknown, req: Record<string, unknown> = {}) => {
  const res = fakeRes();
  await handler({ body: {}, params: {}, ...req } as unknown as Request, res as unknown as Response);
  return res;
};
async function runValidation(body: unknown) {
  const res = fakeRes();
  let passed = false;
  await validate(huntableAreasValidation)({ body } as unknown as Request, res as unknown as Response, () => {
    passed = true;
  });
  return { passed, res, messages: ((res.body as { errors?: { msg: string }[] } | undefined)?.errors ?? []).map((error) => error.msg) };
}

describe("PUT /settings/huntable-areas validation", () => {
  test("accepts a list of known areas, also empty and with duplicates", async () => {
    expect((await runValidation({ areas: ["alpha", "oscar"] })).passed).toBe(true);
    expect((await runValidation({ areas: [] })).passed).toBe(true);
    expect((await runValidation({ areas: ["bravo", "bravo"] })).passed).toBe(true);
  });

  test("rejects a missing or non-list body with a Dutch message", async () => {
    for (const body of [{}, { areas: "alpha" }, { areas: null }]) {
      const { passed, res, messages } = await runValidation(body);
      expect(passed).toBe(false);
      expect(res.statusCode).toBe(400);
      expect(messages).toContain("Areas moet een lijst met deelgebieden zijn.");
    }
  });

  test("rejects unknown areas, other casing and non-strings", async () => {
    for (const areas of [["zulu"], ["Alpha"], [1], ["alpha", ""]]) {
      const { passed, messages } = await runValidation({ areas });
      expect(passed).toBe(false);
      expect(messages[0]).toStartWith("Onbekend deelgebied");
    }
  });
});

describe("huntable areas controller", () => {
  test("GET reports null while not configured", async () => {
    await initHuntableAreas(store);
    expect((await call(getHuntableAreasSetting)).body).toEqual({ areas: null });
  });

  test("PUT stores deduplicated and sorted, logs who, and GET reports it", async () => {
    await initHuntableAreas(store);
    const res = await call(putHuntableAreasSetting, { body: { areas: ["golf", "bravo", "golf"] }, user: { name: "Sanne", _id: "1" } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ areas: ["bravo", "golf"] });
    expect(infoLogs).toContain("Huntable areas set to bravo, golf by Sanne");
    expect((await call(getHuntableAreasSetting)).body).toEqual({ areas: ["bravo", "golf"] });
  });

  test("PUT with an empty list logs (none)", async () => {
    await initHuntableAreas(store);
    const res = await call(putHuntableAreasSetting, { body: { areas: [] }, user: { _id: "7" } });
    expect(res.body).toEqual({ areas: [] });
    expect(infoLogs).toContain("Huntable areas set to (none) by 7");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx --yes bun test src/settings/huntable-areas.route.test.ts`
Expected: FAIL — `Cannot find module './huntable-areas.validation'`.

- [ ] **Step 3: Write the validation chain**

Create `src/settings/huntable-areas.validation.ts` (every message Dutch; a non-string entry gets the same "Onbekend deelgebied" message instead of express-validator's default `Invalid value`):

```ts
import { body } from "express-validator";
import { AREAS } from "../constants/areas";

const UNKNOWN_AREA = `Onbekend deelgebied; kies uit ${AREAS.join(", ")}.`;

/** Body of PUT /settings/huntable-areas: `{ areas: string[] }` with lowercase area names (duplicates are fine, removed on save). */
export const huntableAreasValidation = [
  body("areas").isArray({ max: 50 }).withMessage("Areas moet een lijst met deelgebieden zijn."),
  body("areas.*").isString().withMessage(UNKNOWN_AREA).bail().isIn(AREAS).withMessage(UNKNOWN_AREA),
];
```

- [ ] **Step 4: Add the controller handlers**

In `src/settings/settings.controller.ts` add the import and two handlers:

```ts
import { getHuntableAreas, setHuntableAreas } from "./huntable-areas-setting";
```

```ts
export function getHuntableAreasSetting(_req: Request, res: Response) {
  return res.status(200).json({ areas: getHuntableAreas() });
}

export async function putHuntableAreasSetting(req: Request, res: Response) {
  const areas = await setHuntableAreas(req.body.areas, req.user?.name ?? null);
  logger.info(`Huntable areas set to ${areas.length ? areas.join(", ") : "(none)"} by ${req.user?.name ?? req.user?._id}`);
  return res.status(200).json({ areas });
}
```

- [ ] **Step 5: Register the routes**

In `src/routes/settings.route.ts` add the import

```ts
import { huntableAreasValidation } from "../settings/huntable-areas.validation";
```

and below the `/prediction` routes:

```ts
router.get("/huntable-areas", verifyToken, settingsController.getHuntableAreasSetting);
router.put("/huntable-areas", [verifyToken, isAdmin, validate(huntableAreasValidation)], settingsController.putHuntableAreasSetting);
```

- [ ] **Step 6: Initialise at startup**

In `src/index.ts`, next to the existing import on line 8 add:

```ts
import { initHuntableAreas } from "./settings/huntable-areas-setting";
```

and directly after `await initPredictionSetting(getDemoStateStore());` (line 67):

```ts
await initHuntableAreas(getDemoStateStore());
```

- [ ] **Step 7: Run tests, full suite and typecheck**

Run: `npx --yes bun test src/settings/`
Expected: PASS (prediction, huntable-areas-setting and huntable-areas.route tests).
Run: `npx --yes bun test`
Expected: PASS, 0 fail.
Run: `npx --yes bun x tsc --noEmit`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/settings/huntable-areas.validation.ts src/settings/settings.controller.ts src/settings/huntable-areas.route.test.ts src/routes/settings.route.ts src/index.ts
git commit -m "feat(settings): GET/PUT /settings/huntable-areas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Client rule `isForbiddenArea` and hook `useHuntableAreas`

**Files:**
- Create: `src/lib/huntable-areas.ts`
- Test: `src/lib/huntable-areas.test.ts`
- Modify: `src/lib/response-shape.ts` (OBJECT_CHECKS), `src/lib/response-shape.test.ts`
- Create: `src/hooks/huntable-areas.hook.ts`

(All paths relative to `/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client`.)

**Interfaces:**
- Consumes: server `GET/PUT /settings/huntable-areas` → `{ areas: string[] | null }`; `useAuthSWR`, `fetcherWithMethod` (`src/lib/swr.ts`); `useTeams`, `isHomeTeam` (`src/hooks/teams.hook.ts`; `Team.area?: string`).
- Produces:
  - `isForbiddenArea(area: string, ownArea: string | undefined, allowed: string[] | null | undefined): boolean`
  - `FORBIDDEN_AREA_NOTE = 'niet toegestaan voor onze groep (0 punten)'`
  - `interface HuntableAreasSetting { areas: string[] | null }`
  - `useHuntableAreas(): { allowed: string[] | null | undefined; setAllowed(areas: string[]): Promise<string[]>; isForbidden(area: string): boolean }` — `allowed` undefined while loading, null when not configured; `isForbidden` is stable between renders (useCallback) so map memos don't rebuild; `setAllowed` is optimistic, rolls back and throws the axios error on failure (the Beheer card toasts).

- [ ] **Step 1: Create the branch (working tree must be clean)**

```bash
cd "/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client"
git status --short
git switch main
git switch -c feat/huntable-areas
```

Expected: `git status --short` prints nothing (if it prints anything, stop and report). Now on `feat/huntable-areas`.

- [ ] **Step 2: Write the failing tests**

Create `src/lib/huntable-areas.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { isForbiddenArea } from './huntable-areas';

describe('isForbiddenArea', () => {
  test('not configured (null) or still loading (undefined): nothing is forbidden', () => {
    expect(isForbiddenArea('bravo', 'Alpha', null)).toBe(false);
    expect(isForbiddenArea('bravo', 'Alpha', undefined)).toBe(false);
  });

  test('our own area is never forbidden, even when the list leaves it out', () => {
    expect(isForbiddenArea('alpha', 'alpha', [])).toBe(false);
    expect(isForbiddenArea('alpha', 'alpha', ['bravo'])).toBe(false);
  });

  test('an allowed area is not forbidden', () => {
    expect(isForbiddenArea('bravo', 'alpha', ['bravo', 'delta'])).toBe(false);
  });

  test('an area outside the list is forbidden; an empty list forbids every other area', () => {
    expect(isForbiddenArea('charlie', 'alpha', ['bravo'])).toBe(true);
    expect(isForbiddenArea('oscar', 'alpha', [])).toBe(true);
  });

  test('case-insensitive for the area and our own area ("Alpha" from /areas and /teams)', () => {
    expect(isForbiddenArea('Bravo', 'alpha', ['bravo'])).toBe(false);
    expect(isForbiddenArea('ALPHA', ' Alpha ', [])).toBe(false);
    expect(isForbiddenArea('Charlie', 'Alpha', ['bravo'])).toBe(true);
  });

  test('own area unknown: only the list counts', () => {
    expect(isForbiddenArea('alpha', undefined, ['bravo'])).toBe(true);
    expect(isForbiddenArea('bravo', undefined, ['bravo'])).toBe(false);
  });
});
```

In `src/lib/response-shape.test.ts`, directly after the two `/settings/invites-paused` expectations (around line 63) add:

```ts
    expect(hasExpectedShape('/settings/huntable-areas', { areas: null })).toBe(true);
    expect(hasExpectedShape('/settings/huntable-areas', { areas: ['alpha'] })).toBe(true);
    expect(hasExpectedShape('/settings/huntable-areas', { areas: 'alpha' })).toBe(false);
    expect(hasExpectedShape('/settings/huntable-areas', { message: 'x' })).toBe(false);
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx --yes bun test src/lib/huntable-areas.test.ts src/lib/response-shape.test.ts`
Expected: FAIL — `Cannot find module './huntable-areas'` and the `{ message: 'x' }` / `'alpha'` huntable-areas expectations fail.

- [ ] **Step 4: Write the rule**

Create `src/lib/huntable-areas.ts`:

```ts
/**
 * Rule 5.1: before the game each group hears which fox teams it may hunt; hunts on other teams score 0. Our own
 * (hoofd) fox team is the area of our home team; the others an admin sets team-wide (`/settings/huntable-areas`).
 */

/** Answer of GET /settings/huntable-areas: lowercase areas allowed besides our own, null when not configured. */
export interface HuntableAreasSetting {
  areas: string[] | null;
}

/** Tooltip / aria-label note for a fox we may not hunt. */
export const FORBIDDEN_AREA_NOTE = 'niet toegestaan voor onze groep (0 punten)';

/**
 * Whether hunting `area` scores 0 for us. Not configured or still loading (`allowed` null / undefined): nothing is
 * forbidden. Our own area never is. Case-insensitive ("Alpha" from /areas and /teams, "alpha" from /markers).
 */
export function isForbiddenArea(area: string, ownArea: string | undefined, allowed: string[] | null | undefined): boolean {
  if (!allowed) return false;
  const key = area.trim().toLowerCase();
  if (ownArea !== undefined && key === ownArea.trim().toLowerCase()) return false;
  return !allowed.includes(key);
}
```

- [ ] **Step 5: Add the response shape check**

In `src/lib/response-shape.ts`, in `OBJECT_CHECKS` after the `'/settings/invites-paused'` line add:

```ts
  '/settings/huntable-areas': (data) => data.areas === null || (Array.isArray(data.areas) && data.areas.every((area) => typeof area === 'string')),
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx --yes bun test src/lib/huntable-areas.test.ts src/lib/response-shape.test.ts`
Expected: PASS.

- [ ] **Step 7: Write the hook**

Create `src/hooks/huntable-areas.hook.ts`:

```ts
import { useCallback } from 'react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import { isForbiddenArea, type HuntableAreasSetting } from '@/lib/huntable-areas';
import { isHomeTeam, useTeams } from './teams.hook';

/** Changes a few times per game at most; poll slowly like the prediction setting. */
const SETTING_REFRESH_MS = 30_000;
const URL = '/settings/huntable-areas';

/**
 * Which foxes we may hunt (rule 5.1). `allowed` is undefined while loading and null when an admin never set it (every
 * fox allowed). `isForbidden` also waits for the team list, so our own fox never flashes a lock while /teams loads.
 */
export function useHuntableAreas() {
  const authHeader = useAuthHeader() || '';
  const { data, mutate } = useAuthSWR<HuntableAreasSetting>(URL, { refreshInterval: SETTING_REFRESH_MS });
  const { teams } = useTeams();
  const ownArea = teams?.find(isHomeTeam)?.area;
  const allowed = data?.areas;
  const ready = teams !== undefined;

  const isForbidden = useCallback((area: string) => ready && isForbiddenArea(area, ownArea, allowed), [ready, ownArea, allowed]);

  /** Admin only. Shown at once; on failure the old list comes back and the axios error is thrown (callers toast). */
  const setAllowed = useCallback(
    async (areas: string[]): Promise<string[]> => {
      const result = await mutate(async () => (await fetcherWithMethod(URL, authHeader, 'PUT', { areas })) as HuntableAreasSetting, {
        optimisticData: { areas },
        rollbackOnError: true,
        populateCache: true,
        revalidate: false,
      });
      return result?.areas ?? areas;
    },
    [authHeader, mutate],
  );

  return { allowed, setAllowed, isForbidden };
}
```

- [ ] **Step 8: Typecheck and lint**

Run: `npx tsc -b`
Expected: exit 0, no output.
Run: `npm run lint`
Expected: exit 0, no warnings.

- [ ] **Step 9: Commit**

```bash
git add src/lib/huntable-areas.ts src/lib/huntable-areas.test.ts src/lib/response-shape.ts src/lib/response-shape.test.ts src/hooks/huntable-areas.hook.ts
git commit -m "feat(foxes): huntable areas rule and setting hook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Vossen card option A (dimmed lock chip, hatched bar segment)

**Files:**
- Modify: `src/components/sidebar/foxes/FoxChip.tsx`
- Modify: `src/components/sidebar/foxes/FoxStatusBar.tsx`
- Modify: `src/components/sidebar/foxes/FoxesCard.tsx`

**Interfaces:**
- Consumes: `useHuntableAreas().isForbidden(area: string): boolean`, `FORBIDDEN_AREA_NOTE` (Task 3); `POP`, `POP_SPRING` from `src/lib/motion.ts`; `LockIcon` from `lucide-react`.
- Produces: `FoxChip` prop `forbidden: boolean`; `FoxStatusBar` prop `isForbidden: (area: string) => boolean` (required).

No component test harness exists for these files (tests are pure-lib `bun:test`); the pure rule is covered by Task 3, this task is verified by typecheck, lint and the browser check in Task 7.

- [ ] **Step 1: FoxChip — dim, lock/dot POP swap, tooltip note**

Replace `src/components/sidebar/foxes/FoxChip.tsx` with:

```tsx
import { AnimatePresence, motion } from 'motion/react';
import { LockIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { formatCountdown } from '@/lib/format';
import type { SidebarFox } from '@/lib/fox-status';
import { FORBIDDEN_AREA_NOTE } from '@/lib/huntable-areas';
import { POP, POP_SPRING } from '@/lib/motion';
import { cn, getColorFromArea } from '@/lib/utils';

const STATUS_LABEL: Record<string, string> = { green: 'groen', orange: 'oranje', red: 'rood' };
const ago = (time: Date | string) => formatDistanceToNow(new Date(time), { locale: nl, addSuffix: true });

interface FoxChipProps {
  fox: SidebarFox;
  hidden: boolean;
  /** We may not hunt this fox (rule 5.1): dimmed, a lock instead of the area dot */
  forbidden: boolean;
  /** Pop in on mount (a status change moved the fox here); false on the card's first render */
  popIn: boolean;
  onToggle: () => void;
}

/** Pop in only after the old chip has popped out of its previous group. */
const POP_IN = { ...POP_SPRING, delay: 0.15 };

/**
 * Area dot (a lock when we may not hunt it) + name (+ cooldown); a click hides/shows the area on the map. On a status
 * change it pops out of its old group and pops into the new one.
 */
export default function FoxChip({ fox, hidden, forbidden, popIn, onToggle }: FoxChipProps) {
  const { area, lastHunt, cooldownMs } = fox;
  const title =
    `${fox.name}: ${STATUS_LABEL[area.status] ?? area.status} (bijgewerkt ${ago(area.updatedAt)})` +
    ` · laatste hunt: ${lastHunt ? ago(lastHunt) : 'nog geen'}` +
    (cooldownMs > 0 ? ` · weer te hunten over ${formatCountdown(cooldownMs)}` : '') +
    (forbidden ? ` · ${FORBIDDEN_AREA_NOTE}` : '') +
    (hidden ? ' · verborgen' : '');
  return (
    <motion.button
      layout="position"
      initial={popIn ? POP.initial : false}
      animate={POP.animate}
      exit={POP.exit}
      transition={{ default: POP_IN, layout: { type: 'spring', stiffness: 380, damping: 34 } }}
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={!hidden}
      onClick={onToggle}
      className="cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-ring"
    >
      {/* Hidden / forbidden dim this inner layer, so the pop's own opacity on the button stays independent; the stronger dim (hidden) wins */}
      <span
        className={cn(
          'inline-flex h-[26px] items-center gap-1.5 rounded-full bg-fox-chip px-2.5 text-xs font-semibold transition-opacity duration-200 hover:brightness-110 motion-reduce:transition-none',
          hidden ? 'opacity-40' : forbidden && 'opacity-45',
        )}
      >
        {/* Fixed box so the swap doesn't shift the name; dot and lock pop out/in in place */}
        <span className="relative grid size-2.5 shrink-0 place-items-center">
          <AnimatePresence initial={false}>
            {forbidden ? (
              <motion.span key="lock" className="absolute inset-0 grid place-items-center" initial={POP.initial} animate={POP.animate} exit={POP.exit} transition={POP.transition}>
                <LockIcon aria-hidden className="size-2.5" strokeWidth={2.75} />
              </motion.span>
            ) : (
              <motion.span
                key="dot"
                className="size-[7px] rounded-full"
                style={{ backgroundColor: getColorFromArea(area.name) }}
                initial={POP.initial}
                animate={POP.animate}
                exit={POP.exit}
                transition={POP.transition}
              />
            )}
          </AnimatePresence>
        </span>
        {fox.name}
        {cooldownMs > 0 && <span className="tabular-nums opacity-80">{formatCountdown(cooldownMs)}</span>}
      </span>
    </motion.button>
  );
}
```

Note: the dot is a grid child of the 10px box (centred); the lock is `absolute inset-0` so while both are present during the swap they overlap instead of stacking.

- [ ] **Step 2: FoxStatusBar — dimmed + hatched forbidden segment**

Replace `src/components/sidebar/foxes/FoxStatusBar.tsx` with:

```tsx
import { AnimatePresence, motion } from 'motion/react';
import type { CSSProperties } from 'react';
import type { SidebarFox } from '@/lib/fox-status';
import { cn } from '@/lib/utils';
import { GROUP_CLASS } from './styles';

const LAYOUT_TRANSITION = { type: 'spring', stiffness: 380, damping: 34 } as const;
/** Diagonal stripes in the card colour over a forbidden fox's segment (light and dark theme). */
const HATCH: CSSProperties = { backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 2px, color-mix(in oklab, var(--card) 65%, transparent) 2px 3.5px)' };

/**
 * One segment per fox in group order; segments slide to their new place and fade to the new colour. A fox we may not
 * hunt is dimmed and hatched (the hatch fades in/out).
 */
export default function FoxStatusBar({ foxes, size, isForbidden }: { foxes: SidebarFox[]; size: 'full' | 'mini'; isForbidden: (area: string) => boolean }) {
  const mini = size === 'mini';
  return (
    <span aria-hidden className={cn('flex', mini ? 'h-2 w-[90px] gap-0.5' : 'h-2.5 w-full gap-[3px]')}>
      {foxes.map((fox) => {
        const forbidden = isForbidden(fox.area.name);
        return (
          <motion.span
            key={fox.key}
            layout="position"
            transition={LAYOUT_TRANSITION}
            className={cn(
              'relative flex-1 overflow-hidden rounded-[3px] transition-[background-color,opacity] duration-300 first:rounded-l-md last:rounded-r-md motion-reduce:transition-none',
              GROUP_CLASS[fox.group].bar,
              forbidden && 'opacity-45',
            )}
          >
            <AnimatePresence initial={false}>
              {forbidden && <motion.span key="hatch" className="absolute inset-0" style={HATCH} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} />}
            </AnimatePresence>
          </motion.span>
        );
      })}
    </span>
  );
}
```

- [ ] **Step 3: FoxesCard — wire `isForbidden` into chips and both bars**

In `src/components/sidebar/foxes/FoxesCard.tsx`:

Add the import below the `useAreas` import:

```tsx
import { useHuntableAreas } from '@/hooks/huntable-areas.hook';
```

In `FoxesCard()`, after `const { toggleHidden, isHidden } = useAreas();` add:

```tsx
  const { isForbidden } = useHuntableAreas();
```

Change `<FoxStatusBar foxes={foxes} size="full" />` to:

```tsx
      <FoxStatusBar foxes={foxes} size="full" isForbidden={isForbidden} />
```

Change the chip line to:

```tsx
                        <FoxChip
                          key={fox.key}
                          fox={fox}
                          hidden={isHidden(fox.area.name)}
                          forbidden={isForbidden(fox.area.name)}
                          popIn={mounted}
                          onToggle={() => toggleHidden(fox.area.name)}
                        />
```

In `FoxesSummary()`, after `const foxes = useSidebarFoxes();` add `const { isForbidden } = useHuntableAreas();` (before the early `return null`, hooks must run unconditionally) and change the bar to:

```tsx
      <FoxStatusBar foxes={foxes} size="mini" isForbidden={isForbidden} />
```

- [ ] **Step 4: Typecheck, lint, tests**

Run: `npx tsc -b`
Expected: exit 0.
Run: `npm run lint`
Expected: exit 0.
Run: `npx --yes bun test`
Expected: PASS, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add src/components/sidebar/foxes/FoxChip.tsx src/components/sidebar/foxes/FoxStatusBar.tsx src/components/sidebar/foxes/FoxesCard.tsx
git commit -m "feat(foxes): lock and dim foxes we may not hunt in the Vossen card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `locked` flag in marker image ids and map features

**Files:**
- Modify: `src/lib/marker-style.ts` (`GlyphName`, `MarkerIconKey`, `markerIconId`, `parseKey`)
- Modify: `src/lib/marker-style.test.ts` (`marker image ids` describe)
- Modify: `src/lib/map-layers.ts` (`MarkerFeatureContext`, `markerFeatures`, `predictionPinFeatures`)
- Modify: `src/lib/map-layers.test.ts`

**Interfaces:**
- Consumes: nothing new (pure).
- Produces:
  - `MarkerIconKey` fox: `{ kind: 'fox'; type: FoxKind; status: FoxStatus; area: AreaOrNone; locked: boolean }`; prediction: `{ kind: 'prediction'; area: AreaOrNone; stale: boolean; locked: boolean }`
  - ids: `fox|<type>|<status>|<area>` + `|locked` when locked; `predict|<area>|<live|stale>` + `|locked` when locked (unlocked ids unchanged)
  - (`GlyphName` gets `'lock'` in Task 6 together with its path, because `GLYPHS` is a `Record<GlyphName, string>`.)
  - `MarkerFeatureContext.isForbidden?: (area: string) => boolean` (default: nothing forbidden)
  - `predictionPinFeatures(pins: MapPin[], isForbidden?: (area: string) => boolean)`
  - Areas outside the 9 (`'none'`) are never locked.

- [ ] **Step 1: Write the failing tests**

In `src/lib/marker-style.test.ts`, in `describe('marker image ids')`, replace the fox and prediction entries of `keys` with:

```ts
    { kind: 'fox', type: 'spot', status: 'green', area: 'alpha', locked: false },
    { kind: 'fox', type: 'hunt', status: 'red', area: 'oscar', locked: false },
    { kind: 'fox', type: 'other', status: 'orange', area: 'none', locked: false },
    { kind: 'fox', type: 'spot', status: 'green', area: 'alpha', locked: true },
    { kind: 'fox', type: 'hunt', status: 'orange', area: 'bravo', locked: true },
```

and

```ts
    { kind: 'prediction', area: 'echo', stale: false, locked: false },
    { kind: 'prediction', area: 'echo', stale: true, locked: false },
    { kind: 'prediction', area: 'golf', stale: false, locked: true },
    { kind: 'prediction', area: 'golf', stale: true, locked: true },
```

Replace the `'ids are readable'` test with:

```ts
  test('ids are readable; locked adds a suffix and leaves the other ids as they were', () => {
    expect(markerIconId({ kind: 'fox', type: 'spot', status: 'green', area: 'alpha', locked: false })).toBe('fox|spot|green|alpha');
    expect(markerIconId({ kind: 'fox', type: 'spot', status: 'green', area: 'alpha', locked: true })).toBe('fox|spot|green|alpha|locked');
    expect(markerIconId({ kind: 'prediction', area: 'echo', stale: false, locked: false })).toBe('predict|echo|live');
    expect(markerIconId({ kind: 'prediction', area: 'echo', stale: true, locked: true })).toBe('predict|echo|stale|locked');
    expect(themedImageId('dark', 'hintdot')).toBe('jh|dark|hintdot');
  });

  test('ids from before the locked flag still parse as unlocked', () => {
    expect(parseMarkerImageId('jh|light|fox|hunt|red|oscar')).toEqual({ theme: 'light', key: { kind: 'fox', type: 'hunt', status: 'red', area: 'oscar', locked: false } });
    expect(parseMarkerImageId('jh|dark|predict|echo|live')).toEqual({ theme: 'dark', key: { kind: 'prediction', area: 'echo', stale: false, locked: false } });
  });
```

In the `'other or malformed ids are not ours'` test, extend the id list with:

```ts
'jh|light|fox|spot|green|alpha|nope', 'jh|light|fox|spot|green|alpha|locked|locked', 'jh|light|predict|echo|live|x', 'jh|light|group|delta|open|locked', 'jh|light|hint|alpha|H3|locked'
```

(the last one parses as a hint with 4 parts → `p.length === 3` fails → undefined; keep it in the list.)

In `src/lib/map-layers.test.ts`, inside `describe('markerFeatures')` add:

```ts
  test('spots and hunts of a forbidden area get the locked icon; hints and unknown areas never', () => {
    const isForbidden = (area: string) => area.toLowerCase() !== 'alpha';
    const fc = markerFeatures(
      [fox('a', MarkerType.Spot, 'alpha'), fox('b', MarkerType.Spot, 'Bravo'), fox('c', MarkerType.Hunt, 'charlie'), fox('h1', MarkerType.Hint, 'bravo'), fox('d', 'other' as MarkerType, 'zulu')],
      { statusOf, numbering, nowMs: now, isForbidden },
    );
    expect(fc.features.map((f) => f.properties.icon)).toEqual(['fox|spot|green|alpha', 'fox|spot|orange|bravo|locked', 'fox|hunt|red|charlie|locked', 'hint|bravo|H3', 'fox|other|red|none']);
  });
```

(`h1` gets number 3 from the test's `numbering`, so its label is `H3`.)

Inside `describe('predictionPinFeatures')` add:

```ts
  test('pins of a forbidden area are locked (stale or not); unknown areas never', () => {
    const fc = predictionPinFeatures(
      [
        { area: 'alpha', lng: 5, lat: 52, color: '#f87171', stale: false, confidence: 'high' },
        { area: 'Bravo', lng: 6, lat: 51, color: '#6d45fd', stale: true, confidence: null },
        { area: 'zulu', lng: 6, lat: 51, color: '#6d45fd', stale: false, confidence: null },
      ],
      (area) => area.toLowerCase() !== 'alpha',
    );
    expect(fc.features.map((f) => f.properties.icon)).toEqual(['predict|alpha|live', 'predict|bravo|stale|locked', 'predict|none|live']);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx --yes bun test src/lib/marker-style.test.ts src/lib/map-layers.test.ts`
Expected: FAIL — round-trip (`locked` missing from parsed keys), readable ids (`|locked` missing), and the two new feature tests.

- [ ] **Step 3: Implement the key, id and parser**

In `src/lib/marker-style.ts`, change the two union members of `MarkerIconKey`:

```ts
  | { kind: 'fox'; type: FoxKind; status: FoxStatus; area: AreaOrNone; locked: boolean }
```

```ts
  | { kind: 'prediction'; area: AreaOrNone; stale: boolean; locked: boolean }
```

Update the `MarkerIconKey` doc comment to mention: `locked`: an area we may not hunt (rule 5.1), drawn grey with a lock badge.

Below `const live = ...` add:

```ts
/** Locked markers (an area we may not hunt) get a suffix; unlocked ids stay as they were. */
const lockSuffix = (locked: boolean) => (locked ? '|locked' : '');
```

In `markerIconId`:

```ts
    case 'fox':
      return `fox|${key.type}|${key.status}|${key.area}${lockSuffix(key.locked)}`;
```

```ts
    case 'prediction':
      return `predict|${key.area}|${live(key.stale)}${lockSuffix(key.locked)}`;
```

Below `parseStale` add:

```ts
/** False for `parts` without suffix, true with exactly one `locked` after them, undefined for anything else. */
function parseLocked(p: string[], parts: number): boolean | undefined {
  if (p.length === parts) return false;
  return p.length === parts + 1 && p[parts] === 'locked' ? true : undefined;
}
```

In `parseKey` replace the `'fox'` and `'predict'` cases:

```ts
    case 'fox': {
      const locked = parseLocked(p, 4);
      return locked !== undefined && FOX_KINDS.includes(p[1]) && STATUSES.includes(p[2]) && isArea(p[3])
        ? { kind: 'fox', type: p[1] as FoxKind, status: p[2] as FoxStatus, area: p[3], locked }
        : undefined;
    }
```

```ts
    case 'predict': {
      const stale = parseStale(p[2]);
      const locked = parseLocked(p, 3);
      return locked !== undefined && isArea(p[1]) && stale !== undefined ? { kind: 'prediction', area: p[1], stale, locked } : undefined;
    }
```

- [ ] **Step 4: Implement the features**

In `src/lib/map-layers.ts`, add to `MarkerFeatureContext`:

```ts
  /** Areas we may not hunt (rule 5.1) get the locked icon; default nothing */
  isForbidden?: (area: string) => boolean;
```

Change `markerFeatures`' signature and fox key:

```ts
export function markerFeatures(markers: Marker[], { statusOf, numbering, nowMs, isForbidden = () => false }: MarkerFeatureContext): FeatureCollection<Point, MarkerFeatureProperties> {
```

```ts
        : { kind: 'fox' as const, type: foxKind(marker.type), status: foxStatus(statusOf(marker.area)), area, locked: area !== 'none' && isForbidden(marker.area) };
```

Update its doc comment: append "Spots and hunts of an area we may not hunt are locked (grey, lock badge)."

Replace `predictionPinFeatures`:

```ts
/** One point per AI prediction pin (greyed out when stale; grey with a lock when we may not hunt the area). */
export function predictionPinFeatures(pins: MapPin[], isForbidden: (area: string) => boolean = () => false): FeatureCollection<Point, PredictionPinProperties> {
  return collection(
    pins.map((pin) => {
      const area = areaKey(pin.area) ?? 'none';
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [pin.lng, pin.lat] },
        properties: { area: pin.area, icon: markerIconId({ kind: 'prediction', area, stale: pin.stale, locked: area !== 'none' && isForbidden(pin.area) }) },
      };
    }),
  );
}
```

- [ ] **Step 5: Run tests**

Run: `npx --yes bun test src/lib/marker-style.test.ts src/lib/map-layers.test.ts`
Expected: PASS.
Run: `npx tsc -b`
Expected: errors ONLY if some other file builds a fox/prediction `MarkerIconKey` literal; `grep -rn "kind: 'fox'\|kind: 'prediction'" src --include=*.ts --include=*.tsx | grep -v test` must list only `map-layers.ts` and `marker-style.ts`. Fix any other hit by adding `locked: false`. Then `npx tsc -b` exits 0. (`marker-icons.ts` reads `key.locked` only from Task 6 on, so it still compiles here.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/marker-style.ts src/lib/marker-style.test.ts src/lib/map-layers.ts src/lib/map-layers.test.ts
git commit -m "feat(map): locked flag in fox and prediction marker ids

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Draw locked markers (M6) and wire the map layers

**Files:**
- Modify: `src/lib/marker-style.ts` (`GlyphName` += `'lock'`)
- Modify: `src/components/layers/marker-glyphs.ts` (`GLYPHS.lock`)
- Modify: `src/components/layers/marker-icons.ts` (`drawing()` fox/prediction cases, `drawMarkerIcon`)
- Modify: `src/components/layers/Markers.tsx:72`
- Modify: `src/components/layers/Predictions.tsx:35`
- Test: `src/components/layers/marker-glyphs.test.ts` (create)

**Interfaces:**
- Consumes: `MarkerIconKey.locked` (Task 5), `markerFeatures(..., { isForbidden })`, `predictionPinFeatures(pins, isForbidden)` (Task 5), `useHuntableAreas().isForbidden` (Task 3).
- Produces: map images for `...|locked` ids: neutral roles (`surfaceContainerHighest` fill, `onSurfaceVariant` glyph), lock badge instead of the letter, whole image at 80 % alpha.

- [ ] **Step 1: Write the failing test**

Create `src/components/layers/marker-glyphs.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { GLYPHS } from './marker-glyphs';

describe('GLYPHS', () => {
  test('the lock for markers of areas we may not hunt is a path in the 24 x 24 box', () => {
    expect(GLYPHS.lock).toStartWith('M');
    const numbers = GLYPHS.lock.match(/-?\d*\.?\d+/g)!.map(Number);
    expect(Math.max(...numbers)).toBeLessThanOrEqual(24);
    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(-24);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx --yes bun test src/components/layers/marker-glyphs.test.ts`
Expected: FAIL — `GLYPHS.lock` is undefined (`toStartWith` on undefined).

- [ ] **Step 3: Add the lock glyph**

In `src/lib/marker-style.ts`, extend `GlyphName` with `| 'lock'` (after `'battery_alert'`).

In `src/components/layers/marker-glyphs.ts`, after the `battery_alert` entry add (Material Symbols Rounded `lock-fill.svg`, `@material-symbols/svg-500` 0.48.0, scaled from the 960 box to 24 units):

```ts
  // Locked markers (an area we may not hunt): same source and scaling as the bot message markers
  lock: 'M 5.554 22.137 q -0.703 0 -1.203 -0.5 -0.5 -0.5 -0.5 -1.203 v -10.742 q 0 -0.705 0.5 -1.207 0.5 -0.502 1.203 -0.502 h 1.631 v -2.268 q 0 -2.009 1.407 -3.422 1.406 -1.412 3.41 -1.412 t 3.409 1.412 q 1.405 1.412 1.405 3.422 v 2.268 h 1.631 q 0.705 0 1.207 0.502 0.502 0.502 0.502 1.207 v 10.742 q 0 0.703 -0.502 1.203 -0.502 0.5 -1.207 0.5 h -12.893ZM 13.363 16.437 q 0.562 -0.551 0.562 -1.324 0 -0.75 -0.567 -1.363 t -1.363 -0.613 q -0.796 0 -1.358 0.613 t -0.562 1.375 q 0 0.762 0.567 1.312 t 1.363 0.55 q 0.796 0 1.358 -0.551Zm -4.475 -8.455 h 6.225 v -2.267 q 0 -1.31 -0.904 -2.218 -0.904 -0.908 -2.205 -0.908 -1.3 0 -2.208 0.908 -0.908 0.908 -0.908 2.218 v 2.267Z',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx --yes bun test src/components/layers/marker-glyphs.test.ts`
Expected: PASS.

- [ ] **Step 5: Draw locked fox and prediction markers**

In `src/components/layers/marker-icons.ts`, below `letterBadge` add:

```ts
/** Lock instead of the area letter: a marker of an area we may not hunt (rule 5.1). */
function lockBadge(color: string) {
  return (p: Painter, cx: number, cy: number) => p.glyph('lock', cx, cy, 10, color);
}

/** Locked markers are drawn at this opacity (applied to the finished image, so rim and fill don't show through each other). */
const LOCKED_ALPHA = 0.8;

function isLocked(key: MarkerIconKey): boolean {
  return (key.kind === 'fox' || key.kind === 'prediction') && key.locked;
}

/** Scale the alpha channel (ImageData is not premultiplied). */
function fadeImage(image: ImageData, alpha: number) {
  for (let i = 3; i < image.data.length; i += 4) image.data[i] = Math.round(image.data[i] * alpha);
}
```

Replace the `case 'fox':` and `case 'prediction':` blocks of `drawing()` with:

```ts
    case 'fox': {
      // Locked (an area we may not hunt): neutral grey with a lock badge, whatever the type or status
      const neutral = { container: palette.surfaceContainerHighest, on: palette.onSurfaceVariant };
      const badge = (on: string) => (key.locked ? lockBadge(neutral.on) : letterBadge(key.area, on));
      if (key.type === 'hunt') {
        const { container, on } = key.locked ? neutral : { container: palette.tertiaryContainer, on: palette.onTertiaryContainer };
        return badged(
          FOX_SIZE,
          (p, s) => {
            p.shadow(3, 1);
            p.cookie(s / 2, s / 2, s / 2, palette.surfaceContainerLowest);
            p.noShadow();
            p.cookie(s / 2, s / 2, s / 2 - RIM, container);
            p.glyph('photo_camera', s / 2, s / 2, 20, on);
          },
          badge(on),
        );
      }
      // A spot in the area's status colours; an unknown type (web only) in neutral grey
      const { container, on } = key.locked || key.type !== 'spot' ? neutral : statusColors(key.status, palette);
      return badged(
        FOX_SIZE,
        (p, s) => {
          p.roundedSquare(s, container);
          p.fox(s / 2, s / 2, 22, on);
        },
        badge(on),
      );
    }
    case 'prediction': {
      const grey = key.stale || key.locked;
      const [fill, on] = grey ? [palette.surfaceContainerHighest, palette.onSurfaceVariant] : [palette.tertiary, palette.onTertiary];
      return badged(
        PREDICTION_SIZE,
        (p, s) => {
          p.round(s, fill);
          p.fox(s / 2, s / 2, 18, on);
        },
        // The badge is light: the letter takes the pin colour (on-colour when greyed out); a lock when locked
        key.locked ? lockBadge(on) : letterBadge(key.area, key.stale ? on : fill),
      );
    }
```

In `drawMarkerIcon`, after `const image = ctx.getImageData(0, 0, canvas.width, canvas.height);` add:

```ts
  if (isLocked(key)) fadeImage(image, LOCKED_ALPHA);
```

- [ ] **Step 6: Wire the layers**

`src/components/layers/Markers.tsx`: add the import

```tsx
import { useHuntableAreas } from '@/hooks/huntable-areas.hook';
```

after `const { board } = useHintBoard();` add

```tsx
  const { isForbidden } = useHuntableAreas();
```

and replace line 72:

```tsx
  const features = useMemo(() => markerFeatures(visibleMarkers, { statusOf, numbering, nowMs, isForbidden }), [visibleMarkers, statusOf, numbering, nowMs, isForbidden]);
```

`src/components/layers/Predictions.tsx`: add the same import, after `const { isVisible } = useAreas();` add `const { isForbidden } = useHuntableAreas();`, and replace line 35:

```tsx
  const pins = useMemo(() => predictionPinFeatures(data.pins, isForbidden), [data.pins, isForbidden]);
```

Map images swap without animation (a new id → `styleimagemissing` draws it), as the spec says.

- [ ] **Step 7: Typecheck, lint, full tests**

Run: `npx tsc -b`
Expected: exit 0.
Run: `npm run lint`
Expected: exit 0.
Run: `npx --yes bun test`
Expected: PASS, 0 fail.

- [ ] **Step 8: Commit**

```bash
git add src/lib/marker-style.ts src/components/layers/marker-glyphs.ts src/components/layers/marker-glyphs.test.ts src/components/layers/marker-icons.ts src/components/layers/Markers.tsx src/components/layers/Predictions.tsx
git commit -m "feat(map): grey lock-badged markers for foxes we may not hunt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: End-to-end browser check

**Files:** none changed (fixes found here go in a follow-up commit on the relevant branch).

**Interfaces:**
- Consumes: everything above; server worktree `/home/silke/Documents/Jotihunt 2026/.worktrees/server-huntable`, client branch `feat/huntable-areas`.

- [ ] **Step 1: Start the server worktree on a throwaway database**

Never use the live DB or restart docker. In the server worktree:

```bash
cd "/home/silke/Documents/Jotihunt 2026/.worktrees/server-huntable"
cp "/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-server/.env" .env
PORT=3101 MONGO_URI=mongodb://localhost:27017/jotihunt-huntable-smoke JOTIHUNT_API_URL=http://127.0.0.1:9 \
  PUBLIC_APP_URL=http://localhost:5174 WEBAUTHN_RP_ID=localhost WEBAUTHN_ORIGINS=http://localhost:5174 \
  npx --yes bun run src/index.ts
```

(run in the background; note its PID.) Then create an admin login link:

```bash
MONGO_URI=mongodb://localhost:27017/jotihunt-huntable-smoke PUBLIC_APP_URL=http://localhost:5174 npx --yes bun run src/scripts/login-link.ts --new Tester --admin
```

Expected: the server logs it listens on 3101; the script prints a herstel link.

- [ ] **Step 2: Start the client against it**

```bash
cd "/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client"
API_BASE_URL=http://localhost:3101 npx vite --port 5174 --strictPort
```

(background, note the PID. If `vite-envs` ignores the shell variable, put `API_BASE_URL=http://localhost:3101` in a temporary `.env.development.local` and delete it in Step 4.) Open the herstel link in the preview browser, sign in, open Beheer and turn demo mode on (so areas, markers and predictions exist). With demo data, the home team's area comes from `/teams`.

- [ ] **Step 3: Set the setting and check every surface**

In the preview, run (preview_evaluate):

```js
const token = decodeURIComponent(document.cookie.match(/(?:^|; )_auth=([^;]+)/)[1]);
await fetch('http://localhost:3101/settings/huntable-areas', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ areas: ['bravo', 'delta'] }) }).then((r) => r.json());
```

Expected `{ areas: ['bravo', 'delta'] }`. Within 30 s (or after a reload) check:
- Vossen card: every area except own, bravo and delta has a dimmed chip with a lock (no dot); the swap pops; hidden + forbidden chip is at 40 %; title contains `niet toegestaan voor onze groep (0 punten)`; counts unchanged.
- Full bar and collapsed mini bar: those segments dimmed and hatched, in light and dark theme.
- Map: spots/hunts/prediction pins of those areas grey at ~80 % with a lock badge; own, bravo, delta unchanged; hint labels and group pins unchanged.
- PUT `{ areas: ['bravo','delta','echo'] }`: echo's lock pops back to a dot, its hatch fades out, its markers turn coloured.
- PUT as body `{ areas: ['zulu'] }` → 400 with `Onbekend deelgebied…`.

- [ ] **Step 4: Clean up**

Kill the two background processes by PID (`kill <pid>`, never `pkill -f`), drop the throwaway DB:

```bash
docker exec jotihunt-mongodb-1 mongosh --quiet jotihunt-huntable-smoke --eval 'db.dropDatabase()'
rm "/home/silke/Documents/Jotihunt 2026/.worktrees/server-huntable/.env"
```

- [ ] **Step 5: Final verification and handoff**

Client: `npx --yes bun test && npx tsc -b && npm run lint` → all pass. Server worktree: `npx --yes bun test && npx --yes bun x tsc --noEmit` → all pass. Report both branches (`feat/huntable-areas` in the client repo and in the server worktree) for review; do not merge or push (superpowers:finishing-a-development-branch decides with the user).
