import { formatDistance } from 'date-fns';
import { nl } from 'date-fns/locale';
import type { Feature, FeatureCollection, Point, Polygon } from 'geojson';
import { isLocationStale, LIFE360_PURPLE } from '@/lib/life360';
import { createCircle } from '@/lib/utils';
import type { Life360Location, Life360Member } from '@/types/Life360';

/** Marker look of a member: purple rim, green rim while driving, grey (whole marker) when stale. */
export type Life360Tone = 'live' | 'driving' | 'stale';
const TONES: readonly string[] = ['live', 'driving', 'stale'] satisfies Life360Tone[];

export const LIFE360_DRIVING_GREEN = '#16a34a';
/** Accuracy circle of a stale member (the marker itself is greyed pixel by pixel). */
export const LIFE360_STALE_GREY = '#a1a1aa';

export function life360Tone(location: Life360Location, linkStale: boolean, now: number): Life360Tone {
  if (isLocationStale(location, linkStale, now)) return 'stale';
  return location.driving ? 'driving' : 'live';
}

export function life360RimColor(tone: Life360Tone): string {
  return tone === 'driving' ? LIFE360_DRIVING_GREEN : tone === 'stale' ? LIFE360_STALE_GREY : LIFE360_PURPLE;
}

/** Everything needed to draw one member marker. */
export interface Life360IconSpec {
  memberId: string;
  tone: Life360Tone;
  /** The avatar has loaded (else the initials are drawn) */
  photo: boolean;
  initials: string;
  /** {@link life360AvatarKey} of the avatar path, so a changed avatar is a new image */
  avatar: string;
}

const IMAGE_PREFIX = 'l360';

/** Short stable hash (FNV-1a, base 36) of an avatar path; `-` without an avatar. */
export function life360AvatarKey(avatarUrl: string | null): string {
  if (!avatarUrl) return '-';
  let hash = 0x811c9dc5;
  for (let i = 0; i < avatarUrl.length; i++) hash = Math.imul(hash ^ avatarUrl.charCodeAt(i), 0x01000193) >>> 0;
  return hash.toString(36);
}

/** Map image id, e.g. `l360|m-1|driving|photo|JS|1x2y3z`; a new look (tone, photo loaded, avatar) is a new image. */
export function life360ImageId(spec: Life360IconSpec): string {
  return [IMAGE_PREFIX, spec.memberId, spec.tone, spec.photo ? 'photo' : 'initials', spec.initials, spec.avatar].join('|');
}

/** The spec of one of our images, undefined for any other image id. */
export function parseLife360ImageId(id: string): Life360IconSpec | undefined {
  const parts = id.split('|');
  if (parts.length !== 6 || parts[0] !== IMAGE_PREFIX) return undefined;
  const [, memberId, tone, variant, initials, avatar] = parts;
  if (!memberId || !avatar || !TONES.includes(tone) || (variant !== 'photo' && variant !== 'initials')) return undefined;
  return { memberId, tone: tone as Life360Tone, photo: variant === 'photo', initials, avatar };
}

/** An accuracy worth showing (circle and popup line): a positive, finite radius. */
export function hasUsableAccuracy(accuracyM: number): boolean {
  return Number.isFinite(accuracyM) && accuracyM > 0;
}

/** "5 minuten geleden"; undefined for an unreadable time. */
export function life360Age(at: string, now = Date.now()): string | undefined {
  const time = Date.parse(at);
  if (Number.isNaN(time)) return undefined;
  return formatDistance(time, now, { locale: nl, addSuffix: true });
}

export interface Life360FeatureProperties {
  id: string;
  /** Map image id, see {@link life360ImageId} */
  icon: string;
}

export interface Life360AccuracyProperties {
  id: string;
  color: string;
}

type LocatedMember = Life360Member & { location: Life360Location };

const located = (members: readonly Life360Member[]) => members.filter((member): member is LocatedMember => member.location !== null);

/** One point per sharing member for the symbol layer. */
export function life360Features(
  members: readonly Life360Member[],
  linkStale: boolean,
  hasPhoto: (member: Life360Member) => boolean,
  now = Date.now(),
): FeatureCollection<Point, Life360FeatureProperties> {
  return {
    type: 'FeatureCollection',
    features: located(members).map((member) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [member.location.lon, member.location.lat] },
      properties: {
        id: member.id,
        icon: life360ImageId({
          memberId: member.id,
          tone: life360Tone(member.location, linkStale, now),
          photo: hasPhoto(member),
          initials: member.initials,
          avatar: life360AvatarKey(member.avatarUrl),
        }),
      },
    })),
  };
}

/** Accuracy circle per sharing member with a usable accuracy, in its rim colour. */
export function life360AccuracyCircles(members: readonly Life360Member[], linkStale: boolean, now = Date.now()): FeatureCollection<Polygon, Life360AccuracyProperties> {
  return {
    type: 'FeatureCollection',
    features: located(members)
      .filter((member) => hasUsableAccuracy(member.location.accuracyM))
      .map(
        (member) =>
          ({
            ...createCircle(member.location.lon, member.location.lat, member.location.accuracyM),
            properties: { id: member.id, color: life360RimColor(life360Tone(member.location, linkStale, now)) },
          }) as Feature<Polygon, Life360AccuracyProperties>,
      ),
  };
}

/** Source rectangle of the centred square of a `width` × `height` image (object-fit: cover). */
export function coverRect(width: number, height: number): { sx: number; sy: number; sw: number; sh: number } {
  const side = Math.min(width, height);
  return { sx: (width - side) / 2, sy: (height - side) / 2, sw: side, sh: side };
}

/** In place: Rec. 601 luma grey and alpha × `alpha` — CSS grayscale(1) + opacity .6, without canvas filters (Safari). */
export function greyOut(pixels: Uint8ClampedArray, alpha = 0.6): void {
  for (let i = 0; i < pixels.length; i += 4) {
    const luma = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
    pixels[i] = luma;
    pixels[i + 1] = luma;
    pixels[i + 2] = luma;
    pixels[i + 3] = Math.round(pixels[i + 3] * alpha);
  }
}
