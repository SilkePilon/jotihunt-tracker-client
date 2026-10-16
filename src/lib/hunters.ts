import type { Device } from '@/types/Device';
import type { Position } from '@/types/Position';
import type { Vehicle } from '@/types/Tracker';
import type { User } from '@/types/User';
import { joinParts } from '@/lib/format';
import type { HunterIcon } from '@/lib/marker-style';
import { formatLastUpdate, formatSpeed, isActive, VEHICLE_OPTIONS } from '@/lib/tracker';
import { knotsToKmh } from '@/lib/utils';

/** Traccar group id per vehicle (Beheer → Algemeen, see vehicleGroupIds); undefined when not configured. */
export type VehicleGroupIds = Partial<Record<Vehicle, number>>;

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
      active: isActive(lastUpdate, now),
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

/** A formatter's "–" (unknown) is left out of the meta line */
const known = (value: string) => (value === '–' ? undefined : value);

/**
 * Beheer → Hunters meta line, e.g. "Jesse · Lopend · zojuist · 5 km/u": the linked user (when named differently from
 * the device), vehicle, last update and, while live, speed. The battery shows apart on the right. Unknown parts are left out.
 */
export function hunterMeta(row: HunterRow, now: number): string {
  const vehicle = VEHICLE_OPTIONS.find((option) => option.value === row.vehicle)?.label;
  return joinParts(
    row.user && row.user.name !== row.device.name ? row.user.name : undefined,
    vehicle,
    known(formatLastUpdate(row.lastUpdate, now)),
    row.active ? known(formatSpeed(row.speedKmh)) : undefined,
  );
}

/** Hunters header line: "3 live · 1 niet live" */
export function huntersSummary(rows: HunterRow[]): string {
  const live = rows.filter((row) => row.active).length;
  return `${live} live · ${rows.length - live} niet live`;
}

/** The map marker's icon for a hunter: its vehicle, or a phone when the device's group isn't a vehicle. */
export function hunterIcon(row: HunterRow): HunterIcon {
  return row.vehicle ?? 'phone';
}

/** Under 20 %: the battery shows red. */
export function isLowBattery(percent: number | undefined): boolean {
  return percent !== undefined && percent < 20;
}
