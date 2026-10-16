import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
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

/** Only `config` is persisted, so returning users start with the last known config; `loaded` stays false until /config answers. */
export const useAppConfigStore = create<AppConfigState>()(
  persist(
    (set) => ({
      config: DEFAULT_CONFIG,
      loaded: false,
      setConfig: (config) => set({ config, loaded: true }),
    }),
    {
      name: 'jotihunt-app-config',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ config: state.config }),
      // A config stored by an older client may miss newer fields
      merge: (persisted, current) => {
        const config = (persisted as Partial<Pick<AppConfigState, 'config'>> | undefined)?.config;
        return config ? { ...current, config: { ...DEFAULT_CONFIG, ...config, vehicleGroups: { ...DEFAULT_CONFIG.vehicleGroups, ...config.vehicleGroups } } } : current;
      },
    },
  ),
);

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

export function vehicleGroupIds(config: Pick<PublicConfig, 'vehicleGroups'>): VehicleGroupIds {
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

export type Source = 'db' | 'env' | 'default';
export interface Sourced<T> {
  value: T;
  source: Source;
}
export const AI_SLOTS = ['summary', 'split', 'prediction', 'chat', 'deep', 'tools'] as const;
export type AiSlot = (typeof AI_SLOTS)[number];
export type SecretName = 'geminiApiKey' | 'jotihuntWebPassword' | 'telegramApiHash';
export type PlainName = 'jotihuntWebUsername' | 'telegramApiId' | 'telegramBotUsername';
export interface SecretView {
  set: boolean;
  hint: string | null;
  source: Source;
  /** A stored secret exists but can't be decrypted (server SETTINGS_KEY missing or rotated): the env value is used instead */
  undecryptable: boolean;
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

/** Beheer → Algemeen form: one draft for the Hunt, Ons team, Voertuiggroepen and Jotihunt-site cards */
export interface GeneralDraft {
  /** datetime-local values */
  huntStart: string;
  huntEnd: string;
  homeTeamApiId: number | null;
  groupName: string;
  logoUrl: string;
  discordUrl: string;
  vehicleGroups: Record<Vehicle, number | null>;
  jotihuntWebUsername: string;
  /** Only what's typed; the stored one is never sent to the client */
  jotihuntWebPassword: string;
}

/** Form values from the admin config (db or env values are shown; a default logo shows empty) */
export function draftFrom(config: AdminConfig): GeneralDraft {
  const g = config.general;
  return {
    huntStart: toLocalInput(g.huntStart.value),
    huntEnd: toLocalInput(g.huntEnd.value),
    homeTeamApiId: g.homeTeamApiId.value,
    groupName: g.groupName.value ?? '',
    logoUrl: g.logoUrl.source === 'default' ? '' : g.logoUrl.value,
    discordUrl: g.discordUrl.value ?? '',
    vehicleGroups: g.vehicleGroups.value,
    jotihuntWebUsername: config.plain.jotihuntWebUsername.value ?? '',
    jotihuntWebPassword: '',
  };
}

/** PUT /admin/config/general body: only what changed; empty text becomes null (back to env/default) */
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

const TIMELINE_MARGIN_MS = 2 * 3_600_000;

/** Hunt card timeline (percentages): the range runs from min(now, start) − 2h to end + 2h; `now` is null outside it */
export function timelineGeometry(start: number, end: number, now: number): { left: number; width: number; now: number | null } {
  const from = Math.min(now, start) - TIMELINE_MARGIN_MS;
  const to = Math.max(end, start) + TIMELINE_MARGIN_MS;
  const pct = (t: number) => ((t - from) / (to - from)) * 100;
  return { left: pct(start), width: Math.max(0, pct(end) - pct(start)), now: now >= from && now <= to ? pct(now) : null };
}
