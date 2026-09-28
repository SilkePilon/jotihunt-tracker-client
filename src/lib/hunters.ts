import type { Device } from '@/types/Device';
import type { Position } from '@/types/Position';
import type { Vehicle } from '@/types/Tracker';
import type { User } from '@/types/User';
import { knotsToKmh } from '@/lib/utils';

export const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

/** Traccar group id per vehicle (GROUP_*_ID in .env); undefined when not configured. */
export type VehicleGroupIds = Partial<Record<Vehicle, number>>;

export function vehicleGroupIdsFromEnv(env: Record<string, string | undefined>): VehicleGroupIds {
  const id = (value: string | undefined) => (value && Number.isFinite(Number(value)) ? Number(value) : undefined);
  return { walking: id(env.GROUP_WALKING_ID), bike: id(env.GROUP_BIKE_ID), car: id(env.GROUP_CAR_ID), motorcycle: id(env.GROUP_MOTORCYCLE_ID) };
}

export function vehicleForGroupId(groupId: number | undefined, groups: VehicleGroupIds): Vehicle | undefined {
  if (!groupId) return undefined;
  return (Object.entries(groups) as [Vehicle, number | undefined][]).find(([, id]) => id === groupId)?.[0];
}

export interface HunterRow {
  device: Device;
  position?: Position;
  /** The app user whose "Mijn tracker" created this device */
  user?: User;
  vehicle?: Vehicle;
  active: boolean;
  lastUpdate?: string;
  speedKmh?: number;
  batteryPercent?: number;
  accuracyM?: number;
}

/** One row per Traccar device: newest update first, devices that never reported last. */
export function hunterRows(devices: Device[] | undefined, positions: Position[] | undefined, users: User[] | undefined, groups: VehicleGroupIds, now: number): HunterRow[] {
  const positionByDevice = new Map((positions ?? []).map((position) => [position.deviceId, position]));
  const userByDevice = new Map((users ?? []).filter((user) => user.tracker).map((user) => [user.tracker!.deviceId, user]));
  const rows = (devices ?? []).map((device): HunterRow => {
    const position = positionByDevice.get(device.id);
    const lastUpdate = device.lastUpdate ? new Date(device.lastUpdate).toISOString() : undefined;
    const battery = position?.attributes?.batteryLevel;
    return {
      device,
      position,
      user: userByDevice.get(device.id),
      vehicle: vehicleForGroupId(device.groupId, groups),
      active: !!lastUpdate && now - new Date(lastUpdate).getTime() <= ACTIVE_WINDOW_MS,
      lastUpdate,
      speedKmh: typeof position?.speed === 'number' ? knotsToKmh(position.speed) : undefined,
      batteryPercent: typeof battery === 'number' ? battery : undefined,
      accuracyM: typeof position?.accuracy === 'number' && position.accuracy > 0 ? position.accuracy : undefined,
    };
  });
  const time = (row: HunterRow) => (row.lastUpdate ? new Date(row.lastUpdate).getTime() : -Infinity);
  return rows.sort((a, b) => time(b) - time(a));
}

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function formatCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
