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
