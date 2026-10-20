# Hunt Cooldown Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A quiet push "Alpha mag weer gehunt worden" when the 1 hour cooldown after our last synced hunt on a fox has ended and the fox is green or orange.

**Architecture:** The server notifier (`runNotifier`, every 10 s) gets one more detector: a pure helper decides per area whether to announce, the service reads the newest non-tegenhunt synced hunt per area and stores the announced hunt time per area in `NotifierState.cooldownNotified`, inside the existing compare-and-set claim. The client adds the type to its notification lists, a "Weer huntbaar" tile in Meldingen, and treats the type as silent.

**Tech Stack:** Server: Bun, Express 5, Mongoose, `bun test`. Client: React 19, TS, Vite, lucide-react, `bun test`.

Spec: `jotihunt-tracker-client/docs/superpowers/specs/2026-10-20-hunt-cooldown-push-design.md`.

## Global Constraints

- Type name exactly `hunt-cooldown`; `urgent: false`.
- Title `${Area} mag weer gehunt worden` (area capitalised); body `Groen · laatste hunt HH:MM` / `Oranje · laatste hunt HH:MM`, clock in `Europe/Amsterdam` (existing `clock()` helper).
- Cooldown = 60 minutes after `huntTime`. Push only when status is `green` or `orange`. Too old = cooldown ended more than 2 hours ago: recorded, no push.
- Tegenhunt hunts (status text contains "tegenhunt", case-insensitive) never start a cooldown.
- One push per hunt; first run and the first run with a missing `cooldownNotified` only record, never push.
- Tile: label `Weer huntbaar`, short `1 uur na onze hunt`, description `Als een vos die we gehunt hebben na het uur weer gehunt mag worden (en groen of oranje is).`, lucide `TimerIcon`. On by default.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Server repo: `/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-server`; client repo: `/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client`. Work in the worktrees the controller gives you; never `git stash`, never `pkill -f`.
- Server tests need the docker Mongo the test helper uses (`src/test/db.ts`); run single files with `bun test <file>`. Lint in a worktree: `npx eslint --parser-options tsconfigRootDir:"$PWD" src`.

---

### Task 1: Server helper `huntCooldownReady` + notification builder

**Files:**
- Modify: `src/services/notifier.helpers.ts` (server)
- Test: `src/services/notifier.helpers.test.ts` (server)

**Interfaces:**
- Produces:
  ```ts
  export const HUNT_COOLDOWN_MS = 60 * 60 * 1000;
  export const HUNT_COOLDOWN_MAX_AGE_MS = 2 * 60 * 60 * 1000;
  /** Newest non-tegenhunt synced hunt per area; area lowercase */
  export interface LastHunt { area: string; huntTime: Date }
  export interface CooldownReady { area: string; status: "green" | "orange"; huntTime: Date }
  export function huntCooldownReady(input: {
    lastHunts: readonly LastHunt[];
    /** Area name (any case) → status */
    status: Record<string, string>;
    /** lowercase area → ISO huntTime already handled; null/undefined = not seeded yet */
    notified: Record<string, string> | null | undefined;
    now: Date;
  }): { ready: CooldownReady[]; notified: Record<string, string> };
  export function buildHuntCooldownNotification(ready: CooldownReady): NotificationInput;
  ```
  and `"hunt-cooldown"` in `NOTIFICATION_TYPES` (so also in `OPTIONAL_NOTIFICATION_TYPES`).

- [ ] **Step 1: Write the failing tests** (append to `notifier.helpers.test.ts`, adding the new names to its import from `./notifier.helpers`)

```ts
describe("huntCooldownReady", () => {
  const now = new Date("2026-10-17T20:00:00Z");
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
  const hunt = (area: string, minutesAgo: number) => ({ area, huntTime: ago(minutesAgo) });

  test("not seeded: records every last hunt, announces nothing", () => {
    const result = huntCooldownReady({ lastHunts: [hunt("alpha", 70)], status: { Alpha: "green" }, notified: undefined, now });
    expect(result.ready).toEqual([]);
    expect(result.notified).toEqual({ alpha: ago(70).toISOString() });
  });

  test("announces once the hour is over and the fox is green or orange", () => {
    const result = huntCooldownReady({ lastHunts: [hunt("alpha", 61), hunt("bravo", 65)], status: { Alpha: "green", Bravo: "orange" }, notified: {}, now });
    expect(result.ready).toEqual([
      { area: "alpha", status: "green", huntTime: ago(61) },
      { area: "bravo", status: "orange", huntTime: ago(65) },
    ]);
    expect(result.notified).toEqual({ alpha: ago(61).toISOString(), bravo: ago(65).toISOString() });
  });

  test("still in cooldown: nothing, not recorded", () => {
    const result = huntCooldownReady({ lastHunts: [hunt("alpha", 59)], status: { Alpha: "green" }, notified: {}, now });
    expect(result.ready).toEqual([]);
    expect(result.notified).toEqual({});
  });

  test("red or blue: waits without recording", () => {
    for (const status of ["red", "blue"]) {
      const result = huntCooldownReady({ lastHunts: [hunt("alpha", 90)], status: { Alpha: status }, notified: {}, now });
      expect(result.ready).toEqual([]);
      expect(result.notified).toEqual({});
    }
  });

  test("already announced for this hunt: nothing", () => {
    const result = huntCooldownReady({ lastHunts: [hunt("alpha", 90)], status: { Alpha: "green" }, notified: { alpha: ago(90).toISOString() }, now });
    expect(result.ready).toEqual([]);
  });

  test("a newer hunt re-arms the area", () => {
    const result = huntCooldownReady({ lastHunts: [hunt("alpha", 61)], status: { Alpha: "green" }, notified: { alpha: ago(200).toISOString() }, now });
    expect(result.ready).toHaveLength(1);
  });

  test("cooldown ended more than 2 hours ago: recorded without announcing", () => {
    const result = huntCooldownReady({ lastHunts: [hunt("alpha", 181)], status: { Alpha: "green" }, notified: {}, now });
    expect(result.ready).toEqual([]);
    expect(result.notified).toEqual({ alpha: ago(181).toISOString() });
  });

  test("keeps entries of areas without a last hunt; unknown status waits", () => {
    const result = huntCooldownReady({ lastHunts: [hunt("charlie", 70)], status: {}, notified: { alpha: "2026-10-17T10:00:00.000Z" }, now });
    expect(result.ready).toEqual([]);
    expect(result.notified).toEqual({ alpha: "2026-10-17T10:00:00.000Z" });
  });
});

describe("buildHuntCooldownNotification", () => {
  test("title, body, quiet", () => {
    const notification = buildHuntCooldownNotification({ area: "alpha", status: "green", huntTime: new Date("2026-10-17T12:05:00Z") });
    expect(notification).toEqual({
      type: "hunt-cooldown",
      title: "Alpha mag weer gehunt worden",
      body: "Groen · laatste hunt 14:05",
      urgent: false,
      data: { area: "alpha", status: "green", huntTime: "2026-10-17T12:05:00.000Z" },
    });
    expect(buildHuntCooldownNotification({ area: "bravo", status: "orange", huntTime: new Date("2026-10-17T12:05:00Z") }).body).toBe("Oranje · laatste hunt 14:05");
  });

  test("hunt-cooldown can be switched off", () => {
    expect(OPTIONAL_NOTIFICATION_TYPES).toContain("hunt-cooldown");
  });
});
```

- [ ] **Step 2: Run, expect FAIL** (`huntCooldownReady` not exported)

Run: `bun test src/services/notifier.helpers.test.ts`

- [ ] **Step 3: Implement** in `notifier.helpers.ts`

Change the first line to:
```ts
export const NOTIFICATION_TYPES = ["fox-status", "hint", "article", "hunt-new", "hunt-approved", "hunt-rejected", "broadcast", "counter-hunt", "happy-hour", "hunt-cooldown"] as const;
```
Append:
```ts
/** Rules: after a hunt on a fox we may hunt it again after an hour */
export const HUNT_COOLDOWN_MS = 60 * 60 * 1000;
/** A cooldown that ended longer ago than this is recorded without a push (downtime, late sync of an old hunt) */
export const HUNT_COOLDOWN_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/** Newest synced hunt per area that starts a cooldown (no tegenhunts); area lowercase */
export interface LastHunt {
  area: string;
  huntTime: Date;
}

export interface CooldownReady {
  area: string;
  status: "green" | "orange";
  huntTime: Date;
}

/**
 * Areas whose hunt cooldown is over while they are green or orange, each hunt once. `notified` maps a lowercase area
 * to the ISO hunt time already handled; without it (first run, or the first run after this shipped) every last hunt
 * is only recorded. Red/blue areas wait unrecorded so they fire when they turn green/orange; a cooldown that ended
 * more than HUNT_COOLDOWN_MAX_AGE_MS ago is recorded without a push.
 */
export function huntCooldownReady(input: {
  lastHunts: readonly LastHunt[];
  status: Record<string, string>;
  notified: Record<string, string> | null | undefined;
  now: Date;
}): { ready: CooldownReady[]; notified: Record<string, string> } {
  const statusByArea = new Map(Object.entries(input.status).map(([name, status]) => [name.toLowerCase(), status]));
  const notified: Record<string, string> = { ...(input.notified ?? {}) };
  const ready: CooldownReady[] = [];
  for (const { area: rawArea, huntTime } of input.lastHunts) {
    const area = rawArea.toLowerCase();
    const iso = huntTime.toISOString();
    if (!input.notified) {
      notified[area] = iso;
      continue;
    }
    const handled = notified[area] ? Date.parse(notified[area]) : -Infinity;
    if (huntTime.getTime() <= handled) continue;
    const endsAt = huntTime.getTime() + HUNT_COOLDOWN_MS;
    if (endsAt > input.now.getTime()) continue;
    if (input.now.getTime() - endsAt > HUNT_COOLDOWN_MAX_AGE_MS) {
      notified[area] = iso;
      continue;
    }
    const status = statusByArea.get(area);
    if (status !== "green" && status !== "orange") continue;
    ready.push({ area, status, huntTime });
    notified[area] = iso;
  }
  return { ready, notified };
}

export function buildHuntCooldownNotification(ready: CooldownReady): NotificationInput {
  return {
    type: "hunt-cooldown",
    title: `${capitalize(ready.area)} mag weer gehunt worden`,
    body: `${capitalize(statusNl(ready.status))} · laatste hunt ${clock(ready.huntTime)}`,
    urgent: false,
    data: { area: ready.area, status: ready.status, huntTime: ready.huntTime.toISOString() },
  };
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `bun test src/services/notifier.helpers.test.ts && npx tsc --noEmit`
If tsc reports a `Record<NotificationType, …>` elsewhere missing the new key, add a `"hunt-cooldown"` entry there with the same shape as `"happy-hour"`'s.

- [ ] **Step 5: Commit**

```bash
git add src/services/notifier.helpers.ts src/services/notifier.helpers.test.ts
git commit -m "feat(notifier): hunt cooldown detection helper

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Notifier service + state

**Files:**
- Modify: `src/models/notifier-state.model.ts` (server)
- Modify: `src/services/notifier.service.ts` (server)
- Test: `src/services/notifier.service.test.ts` (server)

**Interfaces:**
- Consumes: `huntCooldownReady`, `buildHuntCooldownNotification`, `LastHunt` from Task 1.
- Produces: `NotifierState.cooldownNotified?: Map<string, string>`; `runNotifier({ now })` now uses `now` (default `new Date()`) for the cooldown.

- [ ] **Step 1: Write the failing tests** (append inside `describe("runNotifier", …)` in `notifier.service.test.ts`; add `import { Hunt } from "../models/hunt.model";`)

Before writing, open `src/models/hunt.model.ts` and check the required fields (e.g. `status`, the required Number field near line 100); fill the `addHunt` defaults so `Hunt.create` passes validation.

```ts
  async function addHunt(area: string, huntTime: Date, statusText = "Goedgekeurd") {
    await Hunt.create({ area, huntTime, status: statusText, statusText /* + other required fields from hunt.model.ts */ });
  }
  const minutesBefore = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

  test("hunt cooldown: pushes once when the hour is over and the fox is green", async () => {
    await setAreas({ Alpha: "green" });
    await run();
    await addHunt("alpha", minutesBefore(61));
    // The first run with a hunt only records it when cooldownNotified did not exist yet: seed it here
    const created = await run();
    expect(created.map((notification) => notification.title)).toEqual(["Alpha mag weer gehunt worden"]);
    expect(created[0].urgent).toBe(false);
    expect(await run()).toHaveLength(0);
  });

  test("hunt cooldown: waits while red, pushes when it turns orange", async () => {
    await setAreas({ Alpha: "red" });
    await run();
    await addHunt("alpha", minutesBefore(70));
    expect((await run()).filter((n) => n.type === "hunt-cooldown")).toHaveLength(0);
    await setAreas({ Alpha: "orange" });
    const created = await run();
    expect(created.map((n) => n.title)).toContain("Alpha mag weer gehunt worden");
  });

  test("hunt cooldown: tegenhunts do not count", async () => {
    await setAreas({ Alpha: "green" });
    await run();
    await addHunt("alpha", minutesBefore(61), "Tegenhunt goedgekeurd");
    expect(await run()).toHaveLength(0);
  });

  test("hunt cooldown: an existing state without cooldownNotified only records", async () => {
    await setAreas({ Alpha: "green" });
    await run();
    await NotifierState.updateOne({}, { $unset: { cooldownNotified: 1 } });
    await addHunt("alpha", minutesBefore(61));
    expect(await run()).toHaveLength(0);
    expect((await NotifierState.findOne().lean())?.cooldownNotified).toEqual({ alpha: minutesBefore(61).toISOString() });
  });

  test("hunt cooldown: a failed insert rolls cooldownNotified back", async () => {
    await setAreas({ Alpha: "green" });
    await run();
    await addHunt("alpha", minutesBefore(61));
    const insert = spyOn(AppNotification, "insertMany").mockRejectedValueOnce(new Error("db down"));
    await expect(run()).rejects.toThrow("db down");
    insert.mockRestore();
    expect((await run()).map((n) => n.title)).toEqual(["Alpha mag weer gehunt worden"]);
  });
```

Note: the first test relies on the first run seeding `cooldownNotified: {}` (there is no hunt yet), so the second run announces. Check how existing tests mock `insertMany` failures (test "a failed insert rolls the state back…" near line 116) and copy that pattern if it differs from `spyOn`.

- [ ] **Step 2: Run, expect FAIL**

Run: `bun test src/services/notifier.service.test.ts`

- [ ] **Step 3: Implement**

`notifier-state.model.ts`, add after `lastArticleId`:
```ts
  /** Lowercase area → ISO time of the hunt whose cooldown end was handled (pushed or skipped). Missing = not seeded yet:
   * that run only records. */
  cooldownNotified: { type: Map, of: String, required: false },
```

`notifier.service.ts`:
- Imports: `Hunt` from `../models/hunt.model`; `buildHuntCooldownNotification`, `huntCooldownReady`, `type LastHunt` from `./notifier.helpers`.
- Update the `now` option doc to `/** Clock for the hunt cooldown (tests); defaults to now */`.
- Add:
```ts
/** Newest synced hunt per area that starts a cooldown: with a hunt time, not a tegenhunt (same rule as the client's lastHuntTimeFor). */
async function lastHuntsPerArea(): Promise<LastHunt[]> {
  const rows = await Hunt.aggregate<{ _id: string; huntTime: Date }>([
    { $match: { huntTime: { $type: "date" }, statusText: { $not: /tegenhunt/i }, status: { $not: /tegenhunt/i } } },
    { $group: { _id: { $toLower: "$area" }, huntTime: { $max: "$huntTime" } } },
  ]);
  return rows.map((row) => ({ area: row._id, huntTime: row.huntTime }));
}
```
- In `runNotifier`: `const now = options.now ?? new Date();` and read `lastHuntsPerArea()` in the same `Promise.all` as state and areas.
- First-run branch: also `$set` `cooldownNotified: huntCooldownReady({ lastHunts, status: currentStatus, notified: null, now }).notified`.
- Normal path, before the claim:
```ts
  const previousCooldown = state.cooldownNotified as Record<string, string> | undefined;
  const cooldown = huntCooldownReady({ lastHunts, status: { ...previousStatus, ...currentStatus }, notified: previousCooldown, now });
```
  Add `cooldownNotified: cooldown.notified` to the claim's `$set`; after the article notifications push `...cooldown.ready.map(buildHuntCooldownNotification)` (inside `if (ownsTransition)`).
- Rollback: when `previousCooldown` is undefined use `{ $set: {…existing…}, $unset: { cooldownNotified: 1 } }`, else add `cooldownNotified: previousCooldown` to the `$set`.

An empty `{}` must be stored (it means "seeded"): Mongoose minimizes empty objects, so add `{ minimize: false }` as the schema options of `NotifierStateSchema` and verify with the first test. `.lean()` returns Mongoose `Map` fields as plain objects; if a test shows a `Map`, convert with `Object.fromEntries`.

- [ ] **Step 4: Run, expect PASS**

Run: `bun test src/services/notifier.service.test.ts src/services/notifier.helpers.test.ts && npx tsc --noEmit && npx eslint --parser-options tsconfigRootDir:"$PWD" src/services src/models`

- [ ] **Step 5: Commit**

```bash
git add src/models/notifier-state.model.ts src/services/notifier.service.ts src/services/notifier.service.test.ts
git commit -m "feat(notifier): push when a fox may be hunted again

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Client type, tile, silent handling

**Files:**
- Modify: `src/lib/notifications.ts` (client)
- Modify: `src/components/notifications/NotificationsDialog.tsx` (client)
- Modify: `public/push-sw.js` (client)
- Test: `src/lib/notifications.test.ts` (client)

**Interfaces:**
- Consumes: server type `hunt-cooldown` (`urgent: false`, `data.area/status/huntTime`).
- Produces: `NotificationType` includes `'hunt-cooldown'`; `isSilent` true for it; `soundKey` maps it to `'fox-status'` (never played since silent).

- [ ] **Step 1: Write the failing tests** (append to `src/lib/notifications.test.ts`, reusing its `n()` helper)

```ts
describe('hunt-cooldown', () => {
  test('silent, info toast, own tile switched on its own', () => {
    const cooldown = n({ type: 'hunt-cooldown', urgent: false, data: { area: 'alpha', status: 'green' } });
    expect(isSilent(cooldown)).toBe(true);
    expect(pickSound([cooldown])).toBeNull();
    expect(toastKind(cooldown)).toBe('info');
    expect(soundKey(cooldown)).toBe('fox-status');
    expect(NOTIFICATION_OPTIONS.find((option) => option.type === 'hunt-cooldown')?.label).toBe('Weer huntbaar');
    expect(toggleType([], 'hunt-cooldown', false)).toEqual(['hunt-cooldown']);
    expect(setAllTypes(false)).toContain('hunt-cooldown');
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `bun test src/lib/notifications.test.ts`

- [ ] **Step 3: Implement**

`src/lib/notifications.ts`:
- Line 1: add `| 'hunt-cooldown'` to `NotificationType`. (`OptionalNotificationType` derives from it or lists types; add it there too if it is a separate list.)
- `NOTIFICATION_OPTIONS`: append
```ts
  { type: 'hunt-cooldown', label: 'Weer huntbaar', short: '1 uur na onze hunt', description: 'Als een vos die we gehunt hebben na het uur weer gehunt mag worden (en groen of oranje is).' },
```
- `soundKey`: add `case 'hunt-cooldown': return 'fox-status';` before `default`.
- `isSilent`:
```ts
/** Quiet notifications: "Happy hour voorbij" (sent non-urgent) and "weer huntbaar". No sound for those. */
export function isSilent(notification: Pick<AppNotification, 'type'> & { urgent?: boolean }): boolean {
  return notification.type === 'hunt-cooldown' || (notification.type === 'happy-hour' && notification.urgent === false);
}
```
- Check the in-app feed (`src/hooks/notification-feed.hook.ts` ~line 60-90): if it plays a sound per toast outside `pickSound`, make sure silent ones skip it.

`NotificationsDialog.tsx`: import `TimerIcon` from lucide-react and add `'hunt-cooldown': TimerIcon,` to `ICONS`. If `NotificationTile` takes a tone/colour per type, use the blue of `COOLDOWN_PILL_CLASS` (`src/lib/fox-status.ts`: blue-50/blue-700, dark blue-500/15 / blue-300); otherwise leave the tile style as is.

`public/push-sw.js`:
```js
        // "Happy hour voorbij" (non-urgent) and "weer huntbaar" are quiet
        silent: payload.type === 'hunt-cooldown' || (payload.type === 'happy-hour' && payload.urgent === false),
```

Then run `npx tsc -b` (or `npx tsc --noEmit -p tsconfig.app.json`) and fix any exhaustive `Record<NotificationType, …>` / switch elsewhere (e.g. `src/lib/hq-director.ts` default case already handles unknown types as neutral messages; leave it).

- [ ] **Step 4: Run, expect PASS**

Run: `bun test src/lib/notifications.test.ts && npx tsc -b && npx eslint --parser-options tsconfigRootDir:"$PWD" src`

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications.ts src/lib/notifications.test.ts src/components/notifications/NotificationsDialog.tsx public/push-sw.js
git commit -m "feat(notifications): Weer huntbaar tile, quiet hunt-cooldown push

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
