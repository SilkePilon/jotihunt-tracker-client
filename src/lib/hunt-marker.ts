import type { Marker } from '@/types/Marker';
import type { SyncedHunt } from '@/types/HuntSync';

/**
 * The map marker made from a synced hunt (source "jotihunt", externalId = the hunt's siteKey), for a sync log line's
 * `huntId`; undefined while the lists load, when the hunt has no siteKey or no marker (e.g. a hunter deleted it).
 */
export function huntMarkerId(huntId: string, hunts: readonly SyncedHunt[] | undefined, markers: readonly Marker[] | undefined): string | undefined {
  const siteKey = hunts?.find((hunt) => hunt._id === huntId)?.siteKey;
  if (!siteKey) return undefined;
  return markers?.find((marker) => marker.source === 'jotihunt' && marker.externalId === siteKey)?._id;
}
