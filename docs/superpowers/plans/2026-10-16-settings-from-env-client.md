# Beheer settings instead of env — client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read team/hunt/vehicle settings from the server's public `/config` instead of build env, and add the Beheer UI to edit them: Algemeen form cards (B3), a new AI tab (A1) and Telegram app details in Koppelingen (T1).

**Architecture:** A small zustand store holds the public config; `<AppConfigSync />` at the root keeps it fresh with SWR (focus + 60 s). Plain functions (e.g. `isHomeTeam`) read the store synchronously, components subscribe with `useAppConfig()`. Admin screens use `/admin/config` and `/admin/ai/*` (server plan `jotihunt-tracker-server/docs/superpowers/plans/2026-10-16-settings-from-env-server.md`, which must be done first).

**Tech Stack:** React 19, Vite + vite-envs, SWR, zustand, motion/react, Tailwind v4, shadcn/radix (`Popover`, `Command`, `Select`), sonner, bun test.

Spec: `docs/superpowers/specs/2026-10-16-beheer-settings-from-env-design.md`. Mockups: `.superpowers/brainstorm/392797-1792156368/content/{ai-tab,algemeen,telegram}.html`.

## Global Constraints

- Beheer look: D1 cards (`BeheerCard`, rounded-3xl `bg-card`), tonal rows (`BeheerRows`/`BeheerRow`), **no icons in card titles**, buttons/segmented/icon buttons use 12px rounding (`Pill`, `IconPill` already do), primary = orange `Pill variant="primary"`.
- Every UI state change animates with motion/react (enter/exit/swap); reuse `@/lib/motion` (`POP`, `SWAP`, `SWAP_TRANSITION`, `REVEAL_TRANSITION`) and `Reveal`/`AutoHeight` from `@/components/motion`.
- UI copy in Dutch; code comments in English.
- An "uit .env" pill (`Tag tone` from `controls/Pill.tsx`, blue) shows on a card when its values come from env (`source === 'env'`).
- Secrets are never shown: only `hint` (e.g. `AIza…fZ`).
- Checks: `npx --yes bun test`, `npx tsc -b`, `npm run lint`. Never restart the docker stack (client :8080 is live).
- Work on branch `feat/settings-from-env`. Commit after each task; end commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File structure

| File | Responsibility |
|---|---|
| `src/lib/app-config.ts` (new) | Types, zustand store, sync getter, date/url helpers |
| `src/lib/app-config.test.ts` (new) | Helper tests |
| `src/hooks/app-config.hook.ts` (new) | `AppConfigSync`, `useAppConfig`, `useAdminConfig`, `useAiModels` |
| `src/components/beheer/AiPane.tsx` (new) | AI tab (A1) |
| `src/components/beheer/ModelPicker.tsx` (new) | Dropdown with search + groups |
| `src/components/beheer/GeneralSettings.tsx` (new) | Algemeen B3 cards + save bar |
| `src/components/beheer/TelegramAppForm.tsx` (new) | T1 app-details fields |
| modified | `main.tsx`, `stores/admin.store.ts`, `BeheerWindow.tsx`, `AlgemeenPane.tsx`, `KoppelingenPane.tsx`, `lib/koppelingen.ts`, `lib/hunters.ts`, `lib/response-shape.ts`, `types/Telegram.ts`, env readers (Task 2), `.env.example` |

---

### Task 1: App config store + sync

**Files:**
- Create: `src/lib/app-config.ts`, `src/lib/app-config.test.ts`, `src/hooks/app-config.hook.ts`
- Modify: `src/main.tsx`, `src/lib/response-shape.ts`

**Interfaces:**
- Produces:
  - `interface PublicConfig { groupName: string | null; logoUrl: string; discordUrl: string | null; huntStart: string | null; huntEnd: string | null; homeTeamApiId: number | null; vehicleGroups: Record<Vehicle, number | null> }`
  - `useAppConfigStore` (zustand, `{ config: PublicConfig; loaded: boolean; setConfig(c: PublicConfig): void }`)
  - `appConfig(): PublicConfig` (sync)
  - `useAppConfig(): PublicConfig & { loaded: boolean }`
  - `<AppConfigSync />`
  - `apiAssetUrl(url: string): string` — prefixes `API_BASE_URL` for `/branding/…` paths
  - `huntWindow(config): { start: Date | null; end: Date | null }`
  - `toLocalInput(iso: string | null): string`, `fromLocalInput(value: string): string | null`
  - `vehicleGroupIds(config): VehicleGroupIds` (drops nulls)

- [ ] **Step 1: Create branch**

```bash
cd "/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client" && git checkout -b feat/settings-from-env
```

- [ ] **Step 2: Write failing tests** — `src/lib/app-config.test.ts`

```ts
import { describe, expect, test } from 'bun:test';
import { apiAssetUrl, DEFAULT_CONFIG, fromLocalInput, huntWindow, toLocalInput, vehicleGroupIds } from './app-config';

describe('app config helpers', () => {
  test('branding paths go to the API, other urls stay', () => {
    expect(apiAssetUrl('/branding/logo?v=1', 'https://x.dev/api')).toBe('https://x.dev/api/branding/logo?v=1');
    expect(apiAssetUrl('/logo.svg', 'https://x.dev/api')).toBe('/logo.svg');
    expect(apiAssetUrl('https://cdn/x.png', 'https://x.dev/api')).toBe('https://cdn/x.png');
  });

  test('datetime-local round trip in local time', () => {
    const iso = '2026-10-17T07:00:00.000Z';
    const local = toLocalInput(iso);
    expect(local).toMatch(/^2026-10-17T\d\d:00$/);
    expect(fromLocalInput(local)).toBe(iso);
    expect(toLocalInput(null)).toBe('');
    expect(fromLocalInput('')).toBeNull();
  });

  test('hunt window and vehicle groups', () => {
    const config = { ...DEFAULT_CONFIG, huntStart: '2026-10-17T07:00:00.000Z', vehicleGroups: { walking: 1, bike: null, car: 3, motorcycle: null } };
    expect(huntWindow(config).start?.toISOString()).toBe('2026-10-17T07:00:00.000Z');
    expect(huntWindow(config).end).toBeNull();
    expect(vehicleGroupIds(config)).toEqual({ walking: 1, car: 3 });
  });
});
```

- [ ] **Step 3: Run** `npx --yes bun test src/lib/app-config.test.ts` → FAIL (module missing).

- [ ] **Step 4: Implement `src/lib/app-config.ts`**

```ts
import { create } from 'zustand';
import type { VehicleGroupIds } from '@/lib/hunters';
import type { Vehicle } from '@/types/Tracker';

/** GET /config (public): settings an admin sets in Beheer → Algemeen (the server falls back to its env). */
export interface PublicConfig {
  groupName: string | null;
  logoUrl: string;
  discordUrl: string | null;
  /** ISO */
  huntStart: string | null;
  huntEnd: string | null;
  homeTeamApiId: number | null;
  vehicleGroups: Record<Vehicle, number | null>;
}

export const DEFAULT_CONFIG: PublicConfig = {
  groupName: null,
  logoUrl: '/logo.svg',
  discordUrl: null,
  huntStart: null,
  huntEnd: null,
  homeTeamApiId: null,
  vehicleGroups: { walking: null, bike: null, car: null, motorcycle: null },
};

interface AppConfigState {
  config: PublicConfig;
  /** False until the first answer of /config */
  loaded: boolean;
  setConfig: (config: PublicConfig) => void;
}

export const useAppConfigStore = create<AppConfigState>()((set) => ({
  config: DEFAULT_CONFIG,
  loaded: false,
  setConfig: (config) => set({ config, loaded: true }),
}));

/** The config right now, for plain functions; components use useAppConfig() so they re-render on changes. */
export function appConfig(): PublicConfig {
  return useAppConfigStore.getState().config;
}

/** An uploaded asset lives on the API (`/branding/logo`): prefix the API base URL; other urls stay as they are. */
export function apiAssetUrl(url: string, base: string = import.meta.env.API_BASE_URL ?? ''): string {
  return url.startsWith('/branding/') ? `${base}${url}` : url;
}

export function huntWindow(config: PublicConfig): { start: Date | null; end: Date | null } {
  return { start: config.huntStart ? new Date(config.huntStart) : null, end: config.huntEnd ? new Date(config.huntEnd) : null };
}

export function vehicleGroupIds(config: PublicConfig): VehicleGroupIds {
  return Object.fromEntries(Object.entries(config.vehicleGroups).filter(([, id]) => id !== null)) as VehicleGroupIds;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO → value of an <input type="datetime-local"> (local time, minutes) */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value (local time) → ISO, or null when empty/invalid */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
```

- [ ] **Step 5: Run tests** → PASS.

- [ ] **Step 6: Sync hook** — `src/hooks/app-config.hook.ts`

```ts
import axios from 'axios';
import { useEffect } from 'react';
import useSWR from 'swr';
import { REQUEST_TIMEOUT_MS } from '@/lib/http';
import { useAppConfigStore, type PublicConfig } from '@/lib/app-config';

const baseUrl = import.meta.env.API_BASE_URL;
/** Settings change a few times per game: refetch on focus and every minute */
const CONFIG_REFRESH_MS = 60_000;

/** Public, so no auth header: the invite and login pages need the name and logo too. */
async function fetchConfig(url: string): Promise<PublicConfig> {
  const { data } = await axios.get<PublicConfig>(`${baseUrl}${url}`, { timeout: REQUEST_TIMEOUT_MS });
  if (typeof data !== 'object' || data === null || typeof data.logoUrl !== 'string') throw new Error('Unexpected /config answer');
  return data;
}

/** Mounted once at the root: keeps the config store in step with the server. Renders nothing. */
export function AppConfigSync() {
  const { data } = useSWR('/config', fetchConfig, { refreshInterval: CONFIG_REFRESH_MS, revalidateOnFocus: true, focusThrottleInterval: 30_000 });
  const setConfig = useAppConfigStore((state) => state.setConfig);
  useEffect(() => {
    if (data) setConfig(data);
  }, [data, setConfig]);
  return null;
}

/** The public config; re-renders when an admin changes it. */
export function useAppConfig() {
  const config = useAppConfigStore((state) => state.config);
  const loaded = useAppConfigStore((state) => state.loaded);
  return { ...config, loaded };
}

/** Refetch /config now (after an admin saved). Add `mutate` to the `swr` import at the top. */
export const revalidateAppConfig = () => mutate('/config');
```

- [ ] **Step 7: Mount** — in `src/main.tsx`, import `{ AppConfigSync } from '@/hooks/app-config.hook'` and render `<AppConfigSync />` inside `<AuthProvider>` just before `<ErrorBoundary variant="page">`.

- [ ] **Step 8: Verify + commit**

Run: `npx --yes bun test src/lib/app-config.test.ts && npx tsc -b` → PASS.

```bash
git add src/lib/app-config.ts src/lib/app-config.test.ts src/hooks/app-config.hook.ts src/main.tsx
git commit -m "feat(config): public app config store synced from /config

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Replace the env reads

**Files (all modify):**
- `src/hooks/teams.hook.ts:9-12` — `isHomeTeam`
- `src/hooks/counter-hunt.hook.ts:7`
- `src/components/sidebar/SidebarSections.tsx:56`, `src/components/mobile/MobileMenu.tsx:81`
- `src/components/sidebar/SidebarHeader.tsx:8-9`, `src/pages/Invite.tsx:16-19`
- `src/components/Map.tsx:114`, `src/components/Settings.tsx:37`
- `src/components/cards/hint-entry/HintEntryCard.tsx:30-31`, `src/components/layers/Markers.tsx:18-20`, `src/components/map/MarkerRegistration.tsx:19-20`, `src/components/intel-window/StatusCard.tsx:125`, `src/hooks/next-hint.hook.ts:41-43`
- `src/components/layers/Devices.tsx:13`, `src/components/beheer/HuntersPane.tsx:26`, `src/lib/hunters.ts:10-16`, `src/lib/hunters.test.ts:8`
- `src/components/DebugInfo.tsx:9-15`

**Interfaces:**
- Consumes: Task 1 (`useAppConfig`, `appConfig`, `huntWindow`, `vehicleGroupIds`, `apiAssetUrl`).
- Produces: no new API; `vehicleGroupIdsFromEnv` is removed.

- [ ] **Step 1: Home team**

`src/hooks/teams.hook.ts`:

```ts
import { appConfig } from '@/lib/app-config';

/** Our own group (Beheer → Algemeen → Ons team). */
export function isHomeTeam(team: Team): boolean {
  const id = appConfig().homeTeamApiId;
  return id !== null && team.apiId === id;
}
```

Components that call `isHomeTeam` while rendering must also re-render when the config arrives: in `useHomeTeam()` add `useAppConfig();` (subscribes) before `teams?.find(isHomeTeam)`. In `src/components/beheer/AlgemeenPane.tsx` `HuntableAreasCard` and `src/hooks/huntable-areas.hook.ts` `useHuntableAreas` add the same `const { homeTeamApiId } = useAppConfig();` and include `homeTeamApiId` in the `useCallback` deps of `isForbidden`.

`src/hooks/counter-hunt.hook.ts`: remove `HAS_HOME_TEAM`; inside `useCounterHunt`: `const { homeTeamApiId } = useAppConfig();` and use `enabled && homeTeamApiId !== null ? '/counter-hunt' : null`.

`SidebarSections.tsx:56` and `MobileMenu.tsx:81`: replace `import.meta.env.HOME_TEAM_API_ID` with `homeTeamApiId !== null` from `const { homeTeamApiId } = useAppConfig();` at the top of the component.

- [ ] **Step 2: Name, logo, Discord**

`SidebarHeader.tsx`:

```ts
const { logoUrl, groupName } = useAppConfig();
const logo = apiAssetUrl(logoUrl);
```

and use `logo` / `groupName ?? ''` where the old constants were used.

`Invite.tsx`: delete `FALLBACK_LOGO`; inside the logo component: `const fallback = apiAssetUrl(useAppConfig().logoUrl);` and use `fallback` for `src` and `onError`; wrap the server-sent `url` too: `src={url ? apiAssetUrl(url) : fallback}`.

`Map.tsx:114`: `const { groupName } = useAppConfig();` at component top (hooks can't be inside the callback at line 114 — move it to the component body) and use `groupName` in the attribution.

`Settings.tsx`: delete the module const; in the component `const { discordUrl } = useAppConfig();` and use it where `DISCORD_URL` was.

- [ ] **Step 3: Hunt window**

`HintEntryCard.tsx`: delete lines 30-31; in the component:

```ts
const { huntStart, huntEnd } = useAppConfig();
const HUNT_START = huntStart ? new Date(huntStart) : null;
const HUNT_END = huntEnd ? new Date(huntEnd) : null;
```

and guard the two `buildHintHours(...)` calls: when `!HUNT_START || !HUNT_END` the hint hours list is empty (`[]`). Check `buildHintHours`'s signature and pass the dates only when both exist.

`Markers.tsx`: delete the two module consts; inside the component:

```ts
const { huntStart, huntEnd } = useAppConfig();
const split = useMemo(() => (huntStart ? markerSplitTime(new Date(huntStart)) : undefined), [huntStart]);
const hunt = useMemo(() => ({ startMs: huntStart ? Date.parse(huntStart) : NaN, endMs: huntEnd ? Date.parse(huntEnd) : NaN }), [huntStart, huntEnd]);
```

Use `split` / `hunt` where `SPLIT` / `HUNT` were and add them to the `useMemo` deps (line 69). If `filterMarkers` requires a `split: Date`, make the field optional in its options type and treat undefined as "no split" (all markers in part 1) — add a one-line test in its existing test file for that case.

`MarkerRegistration.tsx`: same pattern — inside the component derive `HUNT_START_TIME` / `HUNT_END_TIME` from `useAppConfig()` with `new Date(...)`, falling back to `new Date()` when unset so the date picker still works before configuration.

`StatusCard.tsx:125` and `next-hint.hook.ts:41-43`: compute inside the component/hook from `useAppConfig()`; when `huntEnd` is null use `Infinity` for the last slot, when `huntStart` is null pass `new Date()` as the hunt start.

- [ ] **Step 4: Vehicle groups**

`src/lib/hunters.ts`: delete `vehicleGroupIdsFromEnv` (keep `VehicleGroupIds`). `src/lib/hunters.test.ts:8`: `const groups: VehicleGroupIds = { walking: 1, bike: 2, car: 3 };` (import the type).

`Devices.tsx` and `HuntersPane.tsx`: delete `const GROUPS = …`; inside the component `const groups = vehicleGroupIds(useAppConfig());` (wrap in `useMemo` keyed on `JSON.stringify(config.vehicleGroups)` if it's a dep of other memos). In `Devices.tsx` the helper at line 17 takes `groups` as a second argument.

- [ ] **Step 5: DebugInfo** — replace the env lines with values from `useAppConfig()` (show `huntStart`, `huntEnd`, `homeTeamApiId`, `JSON.stringify(vehicleGroups)`).

- [ ] **Step 6: Verify nothing is left**

Run: `grep -rn "import.meta.env.\(HUNT_\|HOME_TEAM\|GROUP_\|LOGO_URL\|DISCORD_URL\)" src` → no output. Then `npx --yes bun test && npx tsc -b && npm run lint` → PASS.

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "feat(config): read hunt window, team, logo, Discord and vehicle groups from /config

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Admin config hooks

**Files:**
- Modify: `src/hooks/app-config.hook.ts`, `src/lib/app-config.ts` (admin types), `src/lib/response-shape.ts`

**Interfaces:**
- Produces:
  - Types `Source`, `Sourced<T>`, `AiSlot` (`'ocr'|'summary'|'split'|'prediction'|'chat'|'deep'|'tools'`), `SecretName`, `PlainName`, `SecretView`, `AdminConfig`, `GeneralPatch`, `GeminiModelInfo`, `ModelList`
  - `useAdminConfig(): { config?: AdminConfig; isError: boolean; saveGeneral(p: GeneralPatch): Promise<AdminConfig>; saveSecret(n: SecretName, v: string): Promise<AdminConfig>; clearSecret(n: SecretName): Promise<AdminConfig>; savePlain(p: Partial<Record<PlainName, string|null>>): Promise<AdminConfig>; uploadLogo(f: File): Promise<AdminConfig>; saveModels(m: Partial<Record<AiSlot, string|null>>): Promise<AdminConfig> }` — every save updates the SWR cache and calls `revalidateAppConfig()`
  - `useAiModels(enabled: boolean): { models?: GeminiModelInfo[]; fetchedAt?: string; error?: string; keyRejected: boolean; refresh(): Promise<void> }`
  - `testAiSlot(slot, authHeader): Promise<{ ok: true; ms: number } | { ok: false; error: string }>`
  - `useTraccarGroups(enabled: boolean): { groups?: { id: number; name: string }[]; isError: boolean }`
  - `testJotihuntLogin(authHeader, login?): Promise<{ ok: true } | { ok: false; error: string }>`

- [ ] **Step 1: Types** (append to `src/lib/app-config.ts`)

```ts
export type Source = 'db' | 'env' | 'default';
export interface Sourced<T> {
  value: T;
  source: Source;
}
export const AI_SLOTS = ['ocr', 'summary', 'split', 'prediction', 'chat', 'deep', 'tools'] as const;
export type AiSlot = (typeof AI_SLOTS)[number];
export type SecretName = 'geminiApiKey' | 'jotihuntWebPassword' | 'telegramApiHash';
export type PlainName = 'jotihuntWebUsername' | 'telegramApiId' | 'telegramBotUsername';
export interface SecretView {
  set: boolean;
  hint: string | null;
  source: Source;
}
/** GET /admin/config */
export interface AdminConfig {
  general: { [K in keyof PublicConfig]: Sourced<PublicConfig[K]> };
  ai: Record<AiSlot, Sourced<string>>;
  secrets: Record<SecretName, SecretView>;
  plain: Record<PlainName, Sourced<string | null>>;
  settingsKeyOk: boolean;
}
/** PUT /admin/config/general (null clears back to env/default) */
export type GeneralPatch = Partial<{
  huntStart: string | null;
  huntEnd: string | null;
  homeTeamApiId: number | null;
  groupName: string | null;
  logoUrl: string | null;
  discordUrl: string | null;
  vehicleGroups: Partial<Record<Vehicle, number | null>>;
}>;
export interface GeminiModelInfo {
  id: string;
  displayName: string;
  group: 'alias' | 'latest' | 'older';
}
export interface ModelList {
  models: GeminiModelInfo[];
  fetchedAt: string;
}
```

- [ ] **Step 2: Shape checks** — `src/lib/response-shape.ts` `OBJECT_CHECKS`:

```ts
  '/admin/config': (data) => isObject(data.general) && isObject(data.ai) && isObject(data.secrets) && typeof data.settingsKeyOk === 'boolean',
  '/admin/ai/models': (data) => Array.isArray(data.models),
```

and add `'/admin/traccar/groups'` to `LIST_PATHS`.

- [ ] **Step 3: Hooks** (append to `src/hooks/app-config.hook.ts`)

```ts
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { apiErrorMessage } from '@/lib/api-error';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import { SLOW_REQUEST_TIMEOUT_MS } from '@/lib/http';
import type { AdminConfig, AiSlot, GeneralPatch, ModelList, PlainName, SecretName } from '@/lib/app-config';

export function useAdminConfig() {
  const authHeader = useAuthHeader() || '';
  const { data, error, mutate } = useAuthSWR<AdminConfig>('/admin/config');

  async function send(url: string, method: 'PUT' | 'POST' | 'DELETE', body?: unknown): Promise<AdminConfig> {
    const next = (await fetcherWithMethod(url, authHeader, method, body)) as AdminConfig;
    await mutate(next, { revalidate: false });
    void revalidateAppConfig();
    return next;
  }

  return {
    config: data,
    isError: !!error,
    saveGeneral: (patch: GeneralPatch) => send('/admin/config/general', 'PUT', patch),
    saveSecret: (name: SecretName, value: string) => send(`/admin/config/secrets/${name}`, 'PUT', { value }),
    clearSecret: (name: SecretName) => send(`/admin/config/secrets/${name}`, 'DELETE'),
    savePlain: (patch: Partial<Record<PlainName, string | null>>) => send('/admin/config/plain', 'PUT', patch),
    saveModels: (models: Partial<Record<AiSlot, string | null>>) => send('/admin/ai/models', 'PUT', { models }),
    uploadLogo: (file: File) => {
      const form = new FormData();
      form.append('logo', file);
      return send('/admin/config/logo', 'POST', form);
    },
  };
}

export function useAiModels(enabled: boolean) {
  const authHeader = useAuthHeader() || '';
  const { data, error, mutate } = useAuthSWR<ModelList>(enabled ? '/admin/ai/models' : null, { revalidateOnFocus: false, shouldRetryOnError: false });
  const status = (error as { response?: { status?: number; data?: { code?: string } } } | undefined)?.response;
  return {
    models: data?.models,
    fetchedAt: data?.fetchedAt,
    error: error ? apiErrorMessage(error, 'Lijst niet beschikbaar') : undefined,
    keyRejected: status?.data?.code === 'key_rejected',
    refresh: async () => {
      await mutate((await fetcherWithMethod('/admin/ai/models?refresh=1', authHeader)) as ModelList, { revalidate: false });
    },
  };
}

export async function testAiSlot(slot: AiSlot, authHeader: string): Promise<{ ok: true; ms: number } | { ok: false; error: string }> {
  return fetcherWithMethod(`/admin/ai/test/${slot}`, authHeader, 'POST', undefined, SLOW_REQUEST_TIMEOUT_MS);
}

export function useTraccarGroups(enabled: boolean) {
  const { data, error } = useAuthSWR<{ id: number; name: string }[]>(enabled ? '/admin/traccar/groups' : null, { revalidateOnFocus: false });
  return { groups: data, isError: !!error };
}

export async function testJotihuntLogin(authHeader: string, login?: { username: string; password: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  return fetcherWithMethod('/admin/jotihunt/test-login', authHeader, 'POST', login ?? {}, SLOW_REQUEST_TIMEOUT_MS);
}
```

Check `apiErrorMessage(error, fallback)` exists in `src/lib/api-error.ts` with that signature (it's used in `KoppelingenPane.tsx`). `fetcherWithMethod` sends `FormData` as-is through axios (multipart is set automatically).

- [ ] **Step 4: Verify + commit**

Run: `npx tsc -b && npx --yes bun test src/lib` → PASS.

```bash
git add -A src
git commit -m "feat(config): admin config, AI model and Traccar group hooks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: AI tab (A1)

**Files:**
- Create: `src/components/beheer/ModelPicker.tsx`, `src/components/beheer/AiPane.tsx`
- Modify: `src/stores/admin.store.ts:4`, `src/components/beheer/BeheerWindow.tsx:3,22-29,150-163`

**Interfaces:**
- Consumes: `useAdminConfig`, `useAiModels`, `testAiSlot` (Task 3); `BeheerPane`, `BeheerCard`, `BeheerRows`, `BeheerRow`, `FadeSwap` (`BeheerLayout`); `Pill`, `IconPill`, `Tag` (`controls/Pill`); `Popover*` from `@/components/ui/popover`; `Command*` from `@/components/ui/command`.
- Produces: `<AiPane />`; `<ModelPicker value onChange models defaultId disabled />`.

UI per mockup `ai-tab.html` option A1:
- Card "Gemini-sleutel" (description "Van aistudio.google.com. Versleuteld opgeslagen."), right side status `Tag`: `Werkt · n modellen` (green, when models loaded), `Uit .env` (blue, when `source === 'env'`), `Sleutel geweigerd` (amber, `keyRejected`), `Geen sleutel` (grey).
- One row: key icon, masked `hint` in mono (or "Nog niet ingesteld — AI staat uit"), `Wijzigen` / `Sleutel toevoegen` pill, `Wissen` ghost pill when `source === 'db'`. Wijzigen unfolds (`Reveal`) an input + Annuleer + Opslaan under the row. No eye/reveal button (the server never sends the key — the mockup's eye is dropped).
- Amber bar when `keyRejected`: "Google weigert deze sleutel. AI-functies staan stil." Amber bar when `!settingsKeyOk`: "SETTINGS_KEY ontbreekt op de server: de sleutel kan hier niet worden opgeslagen."
- Card "Modellen" (description "Welk Gemini-model elke functie gebruikt.", right: ghost pill "Standaard herstellen" → `saveModels` with all slots null). Without key: muted row "Voeg eerst een sleutel toe; dan haalt de lijst de modellen op."
- 7 rows (icon, title, meta) with Test pill + ModelPicker:

| slot | icon (lucide) | title | meta |
|---|---|---|---|
| ocr | `CameraIcon` | Foto OCR | Leest code + tijd van de sticker op hunt-foto's |
| summary | `FileTextIcon` | Artikel-samenvattingen | Korte samenvatting bij elk nieuwsbericht |
| split | `ListTreeIcon` | Hint splitsen | Splitst een hint in losse deelgebied-delen |
| prediction | `RadarIcon` | Vos-voorspelling | Voorspelt bij elke hint waar de vos zit |
| chat | `MessageCircleIcon` | Intel-chat | Gewone antwoorden in de chat |
| deep | `BrainIcon` | Chat "Denk diep" | Als je Denk diep aanzet |
| tools | `WrenchIcon` | Chat-hulpmiddelen | Luchtfoto bekijken, web zoeken, code uitvoeren |

- Test pill: idle `▶ Test` → spinner → `✓ 0,8 s` (green, 3 s, then back) or error toast with the server's message. Label swaps with `Pill morphKey`.

- [ ] **Step 1: Nav entry** — `src/stores/admin.store.ts`: `export type AdminDialogId = 'algemeen' | 'ai' | 'users' | 'invites' | 'hunters' | 'broadcast' | 'koppelingen';`. `BeheerWindow.tsx`: import `SparklesIcon` and `AiPane`; insert `{ id: 'ai', title: 'AI', icon: SparklesIcon },` after Algemeen in `SECTIONS`; add `case 'ai': return <AiPane />;` in the pane switch.

- [ ] **Step 2: ModelPicker** — `src/components/beheer/ModelPicker.tsx`

```tsx
import { useState } from 'react';
import { CheckIcon, ChevronDownIcon, RefreshCwIcon } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { GeminiModelInfo } from '@/lib/app-config';
import { formatAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Chevron } from './BeheerLayout';

const GROUP_TITLE: Record<GeminiModelInfo['group'], string> = { alias: 'Aliassen', latest: 'Nieuwste versie', older: 'Ouder' };

interface ModelPickerProps {
  value: string;
  defaultId: string;
  models: GeminiModelInfo[] | undefined;
  fetchedAt?: string;
  listError?: string;
  onRefresh: () => Promise<void>;
  onChange: (id: string) => void;
  disabled?: boolean;
  label: string;
}

/** A1 dropdown: current model's name; menu with search, groups and a "standaard" tag. */
export default function ModelPicker({ value, defaultId, models, fetchedAt, listError, onRefresh, onChange, disabled, label }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const current = models?.find((model) => model.id === value);
  const name = (current?.displayName ?? value).replace(/^Gemini /, '');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={`Model voor ${label}`}
          className="inline-flex h-[34px] min-w-[190px] items-center justify-between gap-2 rounded-lg bg-beheer-row-high px-3 text-[12.5px] font-semibold outline-none transition-colors hover:bg-beheer-row-high/70 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
        >
          <span className="truncate">{name}</span>
          <Chevron open={open} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-2xl p-1.5">
        <Command>
          <CommandInput placeholder="Zoek model…" />
          <CommandList className="max-h-72">
            <CommandEmpty>{listError ?? 'Geen model gevonden.'}</CommandEmpty>
            {(['alias', 'latest', 'older'] as const).map((group) => {
              const items = models?.filter((model) => model.group === group) ?? [];
              if (!items.length) return null;
              return (
                <CommandGroup key={group} heading={GROUP_TITLE[group]}>
                  {items.map((model) => (
                    <CommandItem
                      key={model.id}
                      value={`${model.displayName} ${model.id}`}
                      onSelect={() => {
                        onChange(model.id);
                        setOpen(false);
                      }}
                      className="gap-2.5 rounded-[10px]"
                    >
                      <CheckIcon className={cn('size-4 text-primary', model.id !== value && 'opacity-0')} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold">{model.displayName}</span>
                        <span className="block font-mono text-[11px] text-muted-foreground">{model.id}</span>
                      </span>
                      {model.id === defaultId && <span className="rounded-md bg-primary-container px-1.5 text-[10px] font-extrabold text-on-primary-container">standaard</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
        <button
          type="button"
          onClick={async () => {
            setRefreshing(true);
            await onRefresh().finally(() => setRefreshing(false));
          }}
          className="mt-1 flex w-full items-center gap-1.5 border-t border-border px-2.5 pt-2 pb-1 text-[11.5px] text-muted-foreground hover:text-foreground"
        >
          <RefreshCwIcon className={cn('size-3.5', refreshing && 'animate-spin')} />
          {listError ? 'Lijst niet beschikbaar · opnieuw proberen' : `Lijst van Google${fetchedAt ? ` · ${formatAgo(fetchedAt, Date.now())}` : ''}`}
        </button>
      </PopoverContent>
    </Popover>
  );
}
```

(Check `formatAgo(iso, now)` in `@/lib/format` — it's used in `lib/koppelingen.ts`. Check `bg-primary-container`/`text-on-primary-container` exist as Tailwind colours in `index.css` (`--color-primary-container` is there; add `--color-on-primary-container: var(--on-primary-container);` in the `@theme` block next to it if missing). Remove the unused `ChevronDownIcon` import if `Chevron` is used.)

- [ ] **Step 3: AiPane** — `src/components/beheer/AiPane.tsx`

```tsx
import { useState, type ComponentType } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { BrainIcon, CameraIcon, CheckIcon, FileTextIcon, KeyRoundIcon, ListTreeIcon, Loader2Icon, MessageCircleIcon, PlayIcon, RadarIcon, TriangleAlertIcon, WrenchIcon } from 'lucide-react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import Reveal from '@/components/motion/Reveal';
import { Input } from '@/components/ui/input';
import { testAiSlot, useAdminConfig, useAiModels } from '@/hooks/app-config.hook';
import { AI_SLOTS, type AiSlot } from '@/lib/app-config';
import { apiErrorMessage } from '@/lib/api-error';
import { POP } from '@/lib/motion';
import { BeheerCard, BeheerPane, BeheerRow, BeheerRows } from './BeheerLayout';
import ModelPicker from './ModelPicker';
import { Pill, Tag } from './controls/Pill';

const ROW_ICON = 'size-[18px] shrink-0 text-muted-foreground';
const DEFAULTS: Record<AiSlot, string> = { ocr: 'gemini-3.8-flash', summary: 'gemini-3.8-flash', split: 'gemini-3.8-flash', chat: 'gemini-3.8-flash', tools: 'gemini-3.8-flash', prediction: 'gemini-pro-latest', deep: 'gemini-pro-latest' };
const SLOT_INFO: Record<AiSlot, { icon: ComponentType<{ className?: string }>; title: string; meta: string }> = {
  ocr: { icon: CameraIcon, title: 'Foto OCR', meta: "Leest code + tijd van de sticker op hunt-foto's" },
  summary: { icon: FileTextIcon, title: 'Artikel-samenvattingen', meta: 'Korte samenvatting bij elk nieuwsbericht' },
  split: { icon: ListTreeIcon, title: 'Hint splitsen', meta: 'Splitst een hint in losse deelgebied-delen' },
  prediction: { icon: RadarIcon, title: 'Vos-voorspelling', meta: 'Voorspelt bij elke hint waar de vos zit' },
  chat: { icon: MessageCircleIcon, title: 'Intel-chat', meta: 'Gewone antwoorden in de chat' },
  deep: { icon: BrainIcon, title: 'Chat "Denk diep"', meta: 'Als je Denk diep aanzet' },
  tools: { icon: WrenchIcon, title: 'Chat-hulpmiddelen', meta: 'Luchtfoto bekijken, web zoeken, code uitvoeren' },
};

/** Amber problem bar, as in the Koppelingen cards */
function Warn({ children }: { children: string }) {
  return (
    <motion.div {...POP} className="mt-3 flex items-center gap-2.5 rounded-2xl bg-amber-500/15 px-3 py-2.5 text-[12.5px] text-amber-700 dark:text-amber-300">
      <TriangleAlertIcon className="size-4 shrink-0" />
      {children}
    </motion.div>
  );
}

function TestButton({ slot }: { slot: AiSlot }) {
  const authHeader = useAuthHeader() || '';
  const [state, setState] = useState<'idle' | 'busy' | { ms: number }>('idle');
  async function run() {
    setState('busy');
    try {
      const result = await testAiSlot(slot, authHeader);
      if (result.ok) {
        setState({ ms: result.ms });
        setTimeout(() => setState('idle'), 3000);
      } else {
        toast.error(result.error);
        setState('idle');
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Testen is mislukt.'));
      setState('idle');
    }
  }
  const key = typeof state === 'object' ? 'ok' : state;
  return (
    <Pill variant={key === 'ok' ? 'success' : 'secondary'} morphKey={key} disabled={state === 'busy'} onClick={() => void run()} aria-label={`Test ${SLOT_INFO[slot].title}`}>
      {key === 'busy' ? <Loader2Icon className="animate-spin" /> : key === 'ok' ? <CheckIcon /> : <PlayIcon />}
      {typeof state === 'object' ? `${(state.ms / 1000).toLocaleString('nl-NL', { maximumFractionDigits: 1 })} s` : 'Test'}
    </Pill>
  );
}

/** Beheer → AI (A1): the Gemini key and which model each feature uses. */
export default function AiPane() {
  const admin = useAdminConfig();
  const key = admin.config?.secrets.geminiApiKey;
  const list = useAiModels(!!key?.set);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  async function saveKey() {
    setSaving(true);
    try {
      await admin.saveSecret('geminiApiKey', draft.trim());
      setEditing(false);
      setDraft('');
      await list.refresh().catch(() => undefined);
      toast.success('Gemini-sleutel opgeslagen');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Opslaan is mislukt.'));
    } finally {
      setSaving(false);
    }
  }

  async function pick(slot: AiSlot, id: string) {
    try {
      await admin.saveModels({ [slot]: id === DEFAULTS[slot] ? null : id });
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Model opslaan is mislukt.'));
    }
  }

  const status = !key?.set ? (
    <Tag tone="muted">Geen sleutel</Tag>
  ) : list.keyRejected ? (
    <Tag tone="warn">Sleutel geweigerd</Tag>
  ) : (
    <span className="flex gap-1.5">
      {key.source === 'env' && <Tag tone="info">Uit .env</Tag>}
      {list.models && <Tag tone="success">Werkt · {list.models.length} modellen</Tag>}
    </span>
  );

  return (
    <BeheerPane title="AI" description="Gemini-sleutel en welk model wat doet.">
      <BeheerCard title="Gemini-sleutel" description="Van aistudio.google.com. Versleuteld opgeslagen." right={status}>
        <BeheerRows>
          <BeheerRow key="key" leading={<KeyRoundIcon className={ROW_ICON} />} title={key?.set ? <span className="font-mono tracking-wide">{key.hint}</span> : 'Nog niet ingesteld'} meta={key?.source === 'env' ? 'Opslaan hier gaat vóór de .env-waarde.' : key?.set ? undefined : 'AI staat uit.'}>
            {key?.source === 'db' && (
              <Pill variant="secondary" onClick={() => void admin.clearSecret('geminiApiKey').catch((error) => toast.error(apiErrorMessage(error, 'Wissen is mislukt.')))}>
                Wissen
              </Pill>
            )}
            <Pill variant={key?.set ? 'secondary' : 'primary'} disabled={!admin.config?.settingsKeyOk} onClick={() => setEditing((open) => !open)}>
              {key?.set ? 'Wijzigen' : 'Sleutel toevoegen'}
            </Pill>
          </BeheerRow>
        </BeheerRows>
        <Reveal>
          {editing && (
            <form
              className="flex gap-2 pt-2.5"
              onSubmit={(event) => {
                event.preventDefault();
                if (draft.trim()) void saveKey();
              }}
            >
              <Input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="AIza…" className="h-9 flex-1 rounded-lg bg-beheer-row-high font-mono text-[13px]" autoComplete="off" spellCheck={false} />
              <Pill variant="secondary" size="md" onClick={() => setEditing(false)}>
                Annuleer
              </Pill>
              <Pill type="submit" variant="primary" size="md" disabled={!draft.trim() || saving} morphKey={saving ? 'busy' : 'idle'}>
                {saving && <Loader2Icon className="animate-spin" />}
                Opslaan
              </Pill>
            </form>
          )}
        </Reveal>
        <AnimatePresence initial={false}>
          {admin.config && !admin.config.settingsKeyOk && <Warn key="nokey">SETTINGS_KEY ontbreekt op de server: de sleutel kan hier niet worden opgeslagen.</Warn>}
          {list.keyRejected && <Warn key="rejected">Google weigert deze sleutel. AI-functies staan stil.</Warn>}
        </AnimatePresence>
      </BeheerCard>

      <BeheerCard
        title="Modellen"
        description="Welk Gemini-model elke functie gebruikt."
        right={
          <Pill variant="secondary" disabled={!key?.set} onClick={() => void admin.saveModels(Object.fromEntries(AI_SLOTS.map((slot) => [slot, null]))).catch((error) => toast.error(apiErrorMessage(error, 'Herstellen is mislukt.')))}>
            Standaard herstellen
          </Pill>
        }
      >
        {key?.set ? (
          <BeheerRows>
            {AI_SLOTS.map((slot) => {
              const info = SLOT_INFO[slot];
              const Icon = info.icon;
              return (
                <BeheerRow key={slot} leading={<Icon className={ROW_ICON} />} title={info.title} meta={info.meta}>
                  <TestButton slot={slot} />
                  <ModelPicker
                    label={info.title}
                    value={admin.config?.ai[slot].value ?? DEFAULTS[slot]}
                    defaultId={DEFAULTS[slot]}
                    models={list.models}
                    fetchedAt={list.fetchedAt}
                    listError={list.error}
                    onRefresh={list.refresh}
                    onChange={(id) => void pick(slot, id)}
                  />
                </BeheerRow>
              );
            })}
          </BeheerRows>
        ) : (
          <p className="rounded-2xl bg-beheer-row px-3 py-2.5 text-[12.5px] text-muted-foreground">Voeg eerst een sleutel toe; dan haalt de lijst de modellen op.</p>
        )}
      </BeheerCard>
    </BeheerPane>
  );
}
```

Check before running: `BeheerRow`'s `title`/`meta` props accept `ReactNode` (widen the type in `BeheerLayout.tsx` if they are `string`). `Tag`'s `tone` variants in `controls/Pill.tsx` — add `info` (blue: `bg-blue-500/15 text-blue-700 dark:text-blue-300`), `warn`, `success`, `muted` if missing, matching the mockup colours. `Pill` has a `success` variant already.

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npm run lint`. Then start a dev server against the smoke server from the server plan (Task 8) — `API_BASE_URL=http://localhost:3099 npx vite --port 5199` — open Beheer → AI in the t3 preview (`preview_open`, then `preview_evaluate` for DOM checks; the snapshot tool is flaky). Check: no key → "Voeg eerst een sleutel toe"; add a fake key → models list error shows "Sleutel geweigerd"; picker opens/closes with animation.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat(beheer): AI tab with Gemini key and per-feature model picker

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Algemeen form cards (B3) with floating save bar

**Files:**
- Create: `src/components/beheer/GeneralSettings.tsx`
- Modify: `src/components/beheer/AlgemeenPane.tsx` (render `<GeneralSettings />` after `<HuntableAreasCard />`)

**Interfaces:**
- Consumes: `useAdminConfig`, `useTraccarGroups`, `testJotihuntLogin` (Task 3); `useTeams` (`@/hooks/teams.hook`); `toLocalInput`, `fromLocalInput`, `apiAssetUrl`, `GeneralPatch` (Task 1/3); `Select*` from `@/components/ui/select`.
- Produces: `<GeneralSettings />`.

Behaviour (mockup `algemeen.html` option B3):
- Four cards, labels above fields, "uit .env" `Tag` in the card header when any of that card's values has `source === 'env'`:
  1. **Hunt** — description "Wanneer de hunt loopt." A thin timeline (track, orange fill from start to end, white "nu" tick, labels) above two `datetime-local` inputs Start / Einde.
  2. **Ons team** — `Select` "Team in Jotihunt-lijst" (teams from `useTeams()`, each with its area dot `getColorFromArea(team.area)`, sorted by name), Groepsnaam input, Logo (preview 36px tile + URL input + "Uploaden" pill opening a hidden `<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml">` which uploads immediately via `uploadLogo`), Discord-link input.
  3. **Voertuiggroepen** — description "Traccar-groep per voertuig." Four `Select`s in a 4-column grid (2 on mobile), labels with the vehicle icon (`VEHICLE_OPTIONS` from `@/lib/tracker` for names/icons); options from `useTraccarGroups(true)` shown as `name` with muted `#id`. Error state: muted line "Traccar niet bereikbaar".
  4. **Jotihunt-site** — description "Login van jotihunt.nl." Status `Tag` (Ingelogd ✓ / Testen… / Inloggen mislukt / Niet ingesteld). Gebruikersnaam input, Wachtwoord input (`type=password`, placeholder = `hint` when set, empty value — typing replaces), "Inloggen testen" pill (tests the typed values when both filled, else the saved ones).
- One draft state for all four cards. Any difference from the saved values shows the floating bar (sticky at the bottom of the pane, slides up with motion): "Niet-opgeslagen wijzigingen · Terugzetten · Opslaan". Opslaan sends one `saveGeneral(patch)` with changed general fields, then `savePlain({ jotihuntWebUsername })` if changed, then `saveSecret('jotihuntWebPassword', pw)` if a password was typed; success toast "Opgeslagen"; on failure toast with the server message and keep the bar. Clearing a text field sends `null` (falls back to env).
- Client validation mirrors the server: end after start → inline red text under Einde "Einde moet na de start liggen." and Opslaan disabled.

- [ ] **Step 1: Draft helpers + test** — add to `src/lib/app-config.ts`:

```ts
export interface GeneralDraft {
  huntStart: string;
  huntEnd: string;
  homeTeamApiId: number | null;
  groupName: string;
  logoUrl: string;
  discordUrl: string;
  vehicleGroups: Record<Vehicle, number | null>;
  jotihuntWebUsername: string;
  jotihuntWebPassword: string;
}

/** Form values from the admin config (db or env values are shown; defaults show empty) */
export function draftFrom(config: AdminConfig): GeneralDraft {
  const g = config.general;
  const shown = <T,>(s: Sourced<T>) => (s.source === 'default' ? null : s.value);
  return {
    huntStart: toLocalInput(g.huntStart.value),
    huntEnd: toLocalInput(g.huntEnd.value),
    homeTeamApiId: g.homeTeamApiId.value,
    groupName: g.groupName.value ?? '',
    logoUrl: shown(g.logoUrl) ?? '',
    discordUrl: g.discordUrl.value ?? '',
    vehicleGroups: g.vehicleGroups.value,
    jotihuntWebUsername: config.plain.jotihuntWebUsername.value ?? '',
    jotihuntWebPassword: '',
  };
}

/** Only what changed; empty strings become null (back to env/default) */
export function generalPatch(saved: GeneralDraft, draft: GeneralDraft): GeneralPatch {
  const patch: GeneralPatch = {};
  if (draft.huntStart !== saved.huntStart) patch.huntStart = fromLocalInput(draft.huntStart);
  if (draft.huntEnd !== saved.huntEnd) patch.huntEnd = fromLocalInput(draft.huntEnd);
  if (draft.homeTeamApiId !== saved.homeTeamApiId) patch.homeTeamApiId = draft.homeTeamApiId;
  for (const key of ['groupName', 'logoUrl', 'discordUrl'] as const) if (draft[key] !== saved[key]) patch[key] = draft[key].trim() || null;
  const vehicles = (Object.keys(draft.vehicleGroups) as Vehicle[]).filter((v) => draft.vehicleGroups[v] !== saved.vehicleGroups[v]);
  if (vehicles.length) patch.vehicleGroups = Object.fromEntries(vehicles.map((v) => [v, draft.vehicleGroups[v]]));
  return patch;
}

export function isDirty(saved: GeneralDraft, draft: GeneralDraft): boolean {
  return Object.keys(generalPatch(saved, draft)).length > 0 || draft.jotihuntWebUsername !== saved.jotihuntWebUsername || draft.jotihuntWebPassword !== '';
}
```

Test (append to `src/lib/app-config.test.ts`):

```ts
import { generalPatch, isDirty, type GeneralDraft } from './app-config';

const base: GeneralDraft = { huntStart: '2026-10-17T09:00', huntEnd: '2026-10-18T15:00', homeTeamApiId: 12, groupName: 'A', logoUrl: '', discordUrl: '', vehicleGroups: { walking: 1, bike: 2, car: 3, motorcycle: null }, jotihuntWebUsername: 'u', jotihuntWebPassword: '' };

test('patch holds only changes; empty text clears', () => {
  expect(generalPatch(base, base)).toEqual({});
  expect(isDirty(base, base)).toBe(false);
  const next = { ...base, groupName: ' ', vehicleGroups: { ...base.vehicleGroups, car: 4 } };
  expect(generalPatch(base, next)).toEqual({ groupName: null, vehicleGroups: { car: 4 } });
  expect(isDirty(base, { ...base, jotihuntWebPassword: 'x' })).toBe(true);
});
```

Run `npx --yes bun test src/lib/app-config.test.ts` → PASS after implementing.

- [ ] **Step 2: Component** — `src/components/beheer/GeneralSettings.tsx`. Structure (fill the markup with existing Beheer classes; the snippets below are the parts with logic):

```tsx
export default function GeneralSettings() {
  const admin = useAdminConfig();
  const { teams } = useTeams();
  const traccar = useTraccarGroups(true);
  const authHeader = useAuthHeader() || '';
  const saved = useMemo(() => (admin.config ? draftFrom(admin.config) : null), [admin.config]);
  const [draft, setDraft] = useState<GeneralDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [login, setLogin] = useState<'idle' | 'busy' | 'ok' | 'fail'>('idle');

  // Take over the saved values when they (re)load and nothing is being edited
  const [lastSaved, setLastSaved] = useState(saved);
  if (saved !== lastSaved) {
    setLastSaved(saved);
    if (!draft || (lastSaved && !isDirty(lastSaved, draft))) setDraft(saved);
  }
  if (!admin.config || !saved || !draft) return <BeheerCard title="Hunt"><Skeleton className="h-24 rounded-2xl" /></BeheerCard>;

  const set = <K extends keyof GeneralDraft>(key: K, value: GeneralDraft[K]) => setDraft({ ...draft, [key]: value });
  const endBeforeStart = !!draft.huntStart && !!draft.huntEnd && draft.huntEnd <= draft.huntStart;
  const dirty = isDirty(saved, draft);
  const fromEnv = (...keys: (keyof AdminConfig['general'])[]) => keys.some((k) => admin.config!.general[k].source === 'env');

  async function save() {
    setSaving(true);
    try {
      const patch = generalPatch(saved!, draft!);
      if (Object.keys(patch).length) await admin.saveGeneral(patch);
      if (draft!.jotihuntWebUsername !== saved!.jotihuntWebUsername) await admin.savePlain({ jotihuntWebUsername: draft!.jotihuntWebUsername.trim() || null });
      if (draft!.jotihuntWebPassword) await admin.saveSecret('jotihuntWebPassword', draft!.jotihuntWebPassword);
      setDraft(null); // re-taken from the fresh saved values on the next render
      toast.success('Opgeslagen');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Opslaan is mislukt.'));
    } finally {
      setSaving(false);
    }
  }

  async function testLogin() {
    setLogin('busy');
    const typed = draft!.jotihuntWebUsername && draft!.jotihuntWebPassword ? { username: draft!.jotihuntWebUsername, password: draft!.jotihuntWebPassword } : undefined;
    try {
      const result = await testJotihuntLogin(authHeader, typed);
      setLogin(result.ok ? 'ok' : 'fail');
      if (!result.ok) toast.error(result.error);
    } catch (error) {
      setLogin('fail');
      toast.error(apiErrorMessage(error, 'Testen is mislukt.'));
    }
  }

  return (
    <>
      <BeheerCard title="Hunt" description="Wanneer de hunt loopt." right={fromEnv('huntStart', 'huntEnd') && <Tag tone="info">uit .env</Tag>}>
        <HuntTimeline start={fromLocalInput(draft.huntStart)} end={fromLocalInput(draft.huntEnd)} />
        <div className="mx-1 mt-2 grid gap-3 sm:grid-cols-2">
          <Field label="Start"><DateTimeInput value={draft.huntStart} onChange={(v) => set('huntStart', v)} /></Field>
          <Field label="Einde" error={endBeforeStart ? 'Einde moet na de start liggen.' : undefined}><DateTimeInput value={draft.huntEnd} onChange={(v) => set('huntEnd', v)} /></Field>
        </div>
      </BeheerCard>
      {/* Ons team, Voertuiggroepen, Jotihunt-site cards as described above */}
      <SaveBar show={dirty} saving={saving} disabled={endBeforeStart} onReset={() => setDraft(saved)} onSave={() => void save()} />
    </>
  );
}
```

Small local components in the same file:
- `Field({ label, error, children })` — `<label className="block"><span className="mb-1 ml-0.5 block text-[11.5px] font-semibold text-muted-foreground">{label}</span>{children}<AnimatePresence>{error && <motion.span {...POP} className="mt-1 block text-xs text-destructive">{error}</motion.span>}</AnimatePresence></label>`
- `DateTimeInput` — `<Input type="datetime-local" className="h-9 rounded-lg bg-beheer-row-high [color-scheme:light] dark:[color-scheme:dark]" … />`
- `HuntTimeline({ start, end })` — returns null when either is null; otherwise a 44px-high relative box: grey track `bg-beheer-row` (h-2, rounded), orange fill positioned between start and end within the range `[min(now, start) - 2h, end + 2h]`, a 2px white "nu" tick when now is inside the range, 10.5px muted labels "nu", `formatDayTime(start)`, `formatDayTime(end)` (e.g. "za 09:00"; use `toLocaleString('nl-NL', { weekday: 'short', hour: '2-digit', minute: '2-digit' })`). The fill animates its `left`/`width` with `motion.div` + `SWAP_TRANSITION`.
- `SaveBar({ show, saving, disabled, onReset, onSave })` — `<AnimatePresence>{show && <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} transition={SWAP_TRANSITION} className="sticky bottom-4 z-10 mt-1 flex items-center gap-2.5 rounded-2xl border border-border bg-beheer-row-high py-2.5 pr-2.5 pl-4 shadow-lg">` with text "Niet-opgeslagen wijzigingen" (flex-1, 13px), `Pill variant="secondary"` Terugzetten, `Pill variant="primary" morphKey` Opslaan / spinner.
- Team `Select`: `value={draft.homeTeamApiId ? String(draft.homeTeamApiId) : ''}`, `onValueChange={(v) => set('homeTeamApiId', Number(v))}`, items `teams?.slice().sort((a, b) => a.name.localeCompare(b.name))`, each `<span className="size-2 rounded-full" style={{ background: getColorFromArea(team.area) }} />` + name.
- Logo upload: on file chosen → `admin.uploadLogo(file)` → toast "Logo geüpload" (or the server's message); the preview `<img src={apiAssetUrl(draft.logoUrl || '/logo.svg')}>` with `key` = url so it fades (`FadeSwap`).

- [ ] **Step 3: Mount** — `AlgemeenPane.tsx`: `import GeneralSettings from './GeneralSettings';` and render `<GeneralSettings />` right after `<HuntableAreasCard />` (before "Functies").

- [ ] **Step 4: Verify** — `npx tsc -b && npm run lint && npx --yes bun test`; then in the preview (same setup as Task 4): change Groepsnaam → bar slides up; Terugzetten → bar slides away; Opslaan → toast, sidebar header shows the new name within a second (store updated by `revalidateAppConfig`); end before start → red text + Opslaan disabled.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat(beheer): Algemeen cards for hunt, team, vehicle groups and Jotihunt login

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Telegram app details (T1)

**Files:**
- Create: `src/components/beheer/TelegramAppForm.tsx`
- Modify: `src/types/Telegram.ts` (add `needsAppCredentials?: boolean` to `TelegramAdminStatus`), `src/lib/koppelingen.ts:44-45`, `src/lib/koppelingen.test.ts`, `src/components/beheer/KoppelingenPane.tsx`

**Interfaces:**
- Consumes: `useAdminConfig` (`config.plain.telegramApiId`, `config.plain.telegramBotUsername`, `config.secrets.telegramApiHash`, `savePlain`, `saveSecret`, `settingsKeyOk`); `useTelegramAdmin().refresh`.
- Produces: `<TelegramAppForm step?: boolean onSaved onCancel />`; `telegramIntegration` returns `canLink: true` + line "Vul eerst de app-gegevens van Telegram in." when `needsAppCredentials`.

- [ ] **Step 1: Failing test** — `src/lib/koppelingen.test.ts`:

```ts
test('unavailable for missing app details can still start linking (step 1 = app details)', () => {
  const view = telegramIntegration({ state: 'unavailable', connected: false, needsAppCredentials: true }, Date.now());
  expect(view.canLink).toBe(true);
  expect(view.line).toBe('Leest berichten van @Jotihunt_bot: tegenhunts en happy hours worden automatisch gemeld.');
  expect(telegramIntegration({ state: 'unavailable', connected: false }, Date.now()).line).toBe('Niet ingesteld op de server (TELEGRAM_SESSION_KEY).');
});
```

Run `npx --yes bun test src/lib/koppelingen.test.ts` → FAIL.

- [ ] **Step 2: Implement in `src/lib/koppelingen.ts`**

```ts
    case 'unavailable':
      if (status.needsAppCredentials) return { ...NONE, tone: 'off', pill: PILL.off, line: 'Leest berichten van @Jotihunt_bot: tegenhunts en happy hours worden automatisch gemeld.', canLink: true };
      return { ...NONE, tone: 'off', pill: PILL.off, line: 'Niet ingesteld op de server (TELEGRAM_SESSION_KEY).' };
```

Run the test → PASS.

- [ ] **Step 3: `TelegramAppForm.tsx`**

```tsx
import { useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { useAdminConfig } from '@/hooks/app-config.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { Pill, Tag } from './controls/Pill';

const FIELD = 'h-9 rounded-lg bg-beheer-row-high font-mono text-[12.5px]';

/** T1: API ID / hash / bot of the group's Telegram app (my.telegram.org). As step 1 of Koppelen, or to change them later. */
export default function TelegramAppForm({ step, onSaved, onCancel }: { step?: boolean; onSaved: () => void; onCancel: () => void }) {
  const admin = useAdminConfig();
  const plain = admin.config?.plain;
  const hash = admin.config?.secrets.telegramApiHash;
  const [apiId, setApiId] = useState(plain?.telegramApiId.value ?? '');
  const [apiHash, setApiHash] = useState('');
  const [bot, setBot] = useState(plain?.telegramBotUsername.value ? `@${plain.telegramBotUsername.value}` : '@Jotihunt_bot');
  const [saving, setSaving] = useState(false);
  const needsHash = !hash?.set;
  const valid = /^\d+$/.test(apiId.trim()) && (!needsHash || apiHash.trim().length > 0);

  async function save() {
    setSaving(true);
    try {
      if (apiHash.trim()) await admin.saveSecret('telegramApiHash', apiHash.trim());
      await admin.savePlain({ telegramApiId: apiId.trim(), telegramBotUsername: bot.trim() || null });
      onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Opslaan is mislukt.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="rounded-2xl bg-beheer-row p-3.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) void save();
      }}
    >
      {step && (
        <div className="mb-2.5 flex items-center gap-2.5">
          <span className="flex gap-1.5">{[0, 1, 2, 3].map((i) => <i key={i} className={`h-[5px] w-6 rounded-full ${i === 0 ? 'bg-primary' : 'bg-beheer-row-high'}`} />)}</span>
          <span className="text-xs text-muted-foreground">Stap 1 van 4</span>
        </div>
      )}
      <b className="mb-2.5 block text-sm">App-gegevens van Telegram</b>
      <div className="grid gap-2.5 sm:grid-cols-[1fr_1.6fr_1fr]">
        <label>
          <span className="mb-1 ml-0.5 block text-[11.5px] font-semibold text-muted-foreground">API ID</span>
          <Input className={FIELD} inputMode="numeric" value={apiId} onChange={(event) => setApiId(event.target.value)} placeholder="1234567" />
        </label>
        <label>
          <span className="mb-1 ml-0.5 block text-[11.5px] font-semibold text-muted-foreground">API hash</span>
          <Input className={FIELD} value={apiHash} onChange={(event) => setApiHash(event.target.value)} placeholder={hash?.set ? `${hash.hint} (laat leeg om te houden)` : '32 tekens'} autoComplete="off" spellCheck={false} />
        </label>
        <label>
          <span className="mb-1 ml-0.5 block text-[11.5px] font-semibold text-muted-foreground">Bot</span>
          <Input className={FIELD} value={bot} onChange={(event) => setBot(event.target.value)} />
        </label>
      </div>
      <p className="mt-2 ml-0.5 text-xs text-muted-foreground">
        Maak een app op{' '}
        <a className="underline" href="https://my.telegram.org/apps" target="_blank" rel="noopener noreferrer">
          my.telegram.org
        </a>{' '}
        → API development tools. {plain?.telegramApiId.source === 'env' && <Tag tone="info">uit .env</Tag>}
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <Pill variant="secondary" onClick={onCancel}>
          Annuleer
        </Pill>
        <Pill type="submit" variant="primary" disabled={!valid || saving || !admin.config?.settingsKeyOk} morphKey={saving ? 'busy' : 'idle'}>
          {saving && <Loader2Icon className="animate-spin" />}
          {step ? 'Volgende' : 'Opslaan'}
        </Pill>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Wire into `KoppelingenPane.tsx`**

State: `const [telegramAppForm, setTelegramAppForm] = useState<'step' | 'edit' | null>(null);` and `const adminConfig = useAdminConfig();`.

- In `startTelegram()`: first line `if (telegram.status?.needsAppCredentials) { setTelegramAppForm('step'); return; }`.
- `panel` prop of the Telegram `IntegrationCard`: `telegramAppForm ? <TelegramAppForm step={telegramAppForm === 'step'} onCancel={() => setTelegramAppForm(null)} onSaved={async () => { const wasStep = telegramAppForm === 'step'; setTelegramAppForm(null); telegram.refresh(); if (wasStep) { await waitForUnlinked(); void startTelegram(); } else toast.success('App-gegevens opgeslagen'); }} /> : (existing telegramPanel element)`.
  - `waitForUnlinked`: the server reconnects asynchronously after saving; poll `telegram.refresh()` up to 10× every 500 ms until `status.state !== 'unavailable'` (implement as a small `async function` in the pane using a ref to the latest status). If it stays unavailable, toast "Telegram start niet met deze app-gegevens." and leave the card as is.
- Under the card's sync line (only when `!telegram.status?.needsAppCredentials` and `adminConfig.config?.plain.telegramApiId.value`): a muted 12px line `App-gegevens: {apiId} · @{bot} {source==='env' && <Tag tone="info">uit .env</Tag>} · <button className="underline">wijzigen</button>` which sets `setTelegramAppForm('edit')`. Pass it through `IntegrationCard`'s existing `syncAction` slot if it fits, else add an optional `footer?: ReactNode` prop to `IntegrationCard` rendered under the sync line with `Reveal`.
- When `adminConfig.config && !adminConfig.config.settingsKeyOk && telegram.status?.needsAppCredentials`: amber bar in the card "SETTINGS_KEY ontbreekt op de server: app-gegevens kunnen niet worden opgeslagen." and Koppelen disabled.

- [ ] **Step 5: Verify** — `npx tsc -b && npm run lint && npx --yes bun test`; preview: with no Telegram env creds, Koppelen → app form (stap 1 van 4) unfolds with animation; Annuleer folds it.

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "feat(koppelingen): Telegram app details as step 1 of linking

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Env cleanup + final checks

**Files:**
- Modify: `.env.example`, `src/vite-env.d.ts` (if it declares the removed vars)

- [ ] **Step 1** — `.env.example`: remove `HUNT_START_TIME`, `HUNT_END_TIME`, `HOME_TEAM_API_ID`, `GROUP_WALKING_ID`, `GROUP_CAR_ID`, `GROUP_MOTORCYCLE_ID`, `GROUP_BIKE_ID`, `DISCORD_URL`, `LOGO_URL`, `GROUP_NAME`. Add above `API_BASE_URL`: `# Team, hunt times, vehicle groups, logo and Discord are set in Beheer → Algemeen (served by the API at /config).` Remove the same names from `src/vite-env.d.ts` if declared there (vite-envs generates types from `.env.example`).

- [ ] **Step 2** — Full checks: `npx --yes bun test && npx tsc -b && npm run lint && npm run build` → all pass. `grep -rn "HUNT_START_TIME\|HOME_TEAM_API_ID\|GROUP_WALKING_ID\|LOGO_URL\|DISCORD_URL" src` → no hits.

- [ ] **Step 3** — Preview pass of all three screens against the smoke server (Task 8 of the server plan) in light and dark (`preview_set_appearance`), desktop and mobile width (`preview_resize` 390×844): Beheer → Algemeen, AI, Koppelingen.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(env): moved settings live in Beheer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Deploy notes (needs user approval at each step)

1. Push server + client `feat/settings-from-env` → merge to `main` → `gh workflow run deploy-image.yml -R SilkePilon/jotihunt-tracker-<repo> --ref main`.
2. Homelab PR: add `SETTINGS_KEY` (`openssl rand -base64 32`) to Secret `jotihunt-secret` and bump image digests. Existing env values keep working as fallback, so the order server → client is safe; the client must not ship before the server (it needs `/config`).
