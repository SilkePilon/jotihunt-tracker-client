import { describe, expect, test } from 'bun:test';
import type { Life360Member } from '@/types/Life360';
import { life360Fixture } from './life360-fixtures';
import {
  coverRect,
  greyOut,
  hasUsableAccuracy,
  LIFE360_DRIVING_GREEN,
  LIFE360_STALE_GREY,
  life360AccuracyCircles,
  life360Age,
  life360AvatarKey,
  life360DrivingText,
  life360Features,
  life360ImageId,
  life360RimColor,
  life360Tone,
  parseLife360ImageId,
} from './life360-map';
import { LIFE360_PURPLE } from './life360';
import { HUNTERS_LAYER, LIFE360_ACCURACY_LAYER, LIFE360_HOVER_LAYER, LIFE360_LAYER, MAP_LAYER_STACK } from './map-layers';

const NOW = Date.parse('2026-10-17T12:00:00Z');
const members = life360Fixture('linked', NOW).members.members;
const byId = (id: string) => members.find((member) => member.id === id)!;
const hasPhoto = (member: Life360Member) => member.avatarUrl !== null;

describe('life360Tone', () => {
  test('driving, live, or stale (old fix or stale link)', () => {
    expect(life360Tone(byId('m-jesse').location!, false, NOW)).toBe('driving');
    expect(life360Tone(byId('m-mila').location!, false, NOW)).toBe('live');
    expect(life360Tone(byId('m-lars').location!, false, NOW)).toBe('stale');
    expect(life360Tone(byId('m-jesse').location!, true, NOW)).toBe('stale');
  });

  test('driving text only for a live (not stale) driving member', () => {
    expect(life360DrivingText(byId('m-jesse').location!, false, NOW)).toBe('Rijdt 42 km/u');
    expect(life360DrivingText({ ...byId('m-jesse').location!, speedKmh: null }, false, NOW)).toBe('Rijdt');
    // Logged out / paused link: the last known position, no longer driving
    expect(life360DrivingText(byId('m-jesse').location!, true, NOW)).toBeUndefined();
    // An old fix that still says driving
    expect(life360DrivingText({ ...byId('m-lars').location!, driving: true, speedKmh: 30 }, false, NOW)).toBeUndefined();
    expect(life360DrivingText(byId('m-mila').location!, false, NOW)).toBeUndefined();
  });

  test('rim colours: purple, green while driving, grey when stale', () => {
    expect(life360RimColor('live')).toBe(LIFE360_PURPLE);
    expect(life360RimColor('driving')).toBe(LIFE360_DRIVING_GREEN);
    expect(life360RimColor('stale')).toBe(LIFE360_STALE_GREY);
  });
});

describe('image ids', () => {
  test('round trip', () => {
    const spec = { memberId: 'm-jesse', tone: 'driving' as const, photo: true, initials: 'JS', avatar: 'abc123' };
    expect(life360ImageId(spec)).toBe('l360|m-jesse|driving|photo|JS|abc123');
    expect(parseLife360ImageId(life360ImageId(spec))).toEqual(spec);
    expect(parseLife360ImageId('l360|m-lars|stale|initials|LB|-')).toEqual({ memberId: 'm-lars', tone: 'stale', photo: false, initials: 'LB', avatar: '-' });
  });

  test('other images are not ours', () => {
    expect(parseLife360ImageId('jh|light|arrow')).toBeUndefined();
    expect(parseLife360ImageId('l360|m-1|fast|photo|JS|a')).toBeUndefined();
    expect(parseLife360ImageId('l360|m-1|live|video|JS|a')).toBeUndefined();
    expect(parseLife360ImageId('l360|m-1|live|photo|JS')).toBeUndefined();
    expect(parseLife360ImageId('l360||live|photo|JS|a')).toBeUndefined();
    expect(parseLife360ImageId('l360|m-1|live|photo|JS|')).toBeUndefined();
  });

  test('avatar key: short, stable, changes with the avatar, "-" without one', () => {
    const key = life360AvatarKey('/life360/avatars/m-jesse?v=1');
    expect(key).toMatch(/^[0-9a-z]{1,7}$/);
    expect(life360AvatarKey('/life360/avatars/m-jesse?v=1')).toBe(key);
    expect(life360AvatarKey('/life360/avatars/m-jesse?v=2')).not.toBe(key);
    expect(life360AvatarKey(null)).toBe('-');
  });
});

describe('life360Features', () => {
  test('one point per sharing member, with its icon', () => {
    const features = life360Features(members, false, hasPhoto, NOW).features;
    expect(features.map((feature) => feature.properties.id)).toEqual(['m-jesse', 'm-mila', 'm-lars', 'm-sem', 'm-noor']);
    expect(features[0].geometry.coordinates).toEqual([5.1214, 52.0907]);
    expect(features[0].properties.icon).toBe(`l360|m-jesse|driving|photo|JS|${life360AvatarKey(byId('m-jesse').avatarUrl)}`);
    expect(features[2].properties.icon).toBe(`l360|m-lars|stale|initials|LB|${life360AvatarKey(byId('m-lars').avatarUrl)}`);
  });

  test('a stale link greys every member; a photo only once loaded', () => {
    const features = life360Features(members, true, () => false, NOW).features;
    expect(features.every((feature) => feature.properties.icon.includes('|stale|initials|'))).toBe(true);
  });

  test('greys an idle member once the clock passes 15 min, without new data', () => {
    const at = new Date(NOW - 14 * 60_000).toISOString();
    const idle = [{ ...byId('m-mila'), location: { ...byId('m-mila').location!, at } }];
    expect(life360Features(idle, false, hasPhoto, NOW).features[0].properties.icon).toContain('|live|');
    expect(life360Features(idle, false, hasPhoto, NOW + 2 * 60_000).features[0].properties.icon).toContain('|stale|');
  });

  test('a new avatar is a new image', () => {
    const jesse = byId('m-jesse');
    const before = life360Features([jesse], false, hasPhoto, NOW).features[0].properties.icon;
    const after = life360Features([{ ...jesse, avatarUrl: `${jesse.avatarUrl}-new` }], false, hasPhoto, NOW).features[0].properties.icon;
    expect(after).not.toBe(before);
  });
});

test('hasUsableAccuracy: only a positive, finite radius', () => {
  expect(hasUsableAccuracy(12)).toBe(true);
  expect(hasUsableAccuracy(0)).toBe(false);
  expect(hasUsableAccuracy(-5)).toBe(false);
  expect(hasUsableAccuracy(Number.NaN)).toBe(false);
});

test('life360Age: Dutch relative age, undefined for an unreadable time', () => {
  expect(life360Age(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe('5 minuten geleden');
  expect(life360Age('not a date', NOW)).toBeUndefined();
  expect(life360Age('', NOW)).toBeUndefined();
});

test('life360AccuracyCircles: a polygon per sharing member, in the rim colour', () => {
  const circles = life360AccuracyCircles(members, false, NOW).features;
  expect(circles).toHaveLength(5);
  expect(circles[0].geometry.type).toBe('Polygon');
  expect(circles.map((circle) => circle.properties.color)).toEqual([LIFE360_DRIVING_GREEN, LIFE360_PURPLE, LIFE360_STALE_GREY, LIFE360_PURPLE, LIFE360_PURPLE]);
  const noAccuracy = members.map((member) => (member.location ? { ...member, location: { ...member.location, accuracyM: 0 } } : member));
  expect(life360AccuracyCircles(noAccuracy, false, NOW).features).toHaveLength(0);
});

test('coverRect: the centred square of the image', () => {
  expect(coverRect(200, 100)).toEqual({ sx: 50, sy: 0, sw: 100, sh: 100 });
  expect(coverRect(100, 300)).toEqual({ sx: 0, sy: 100, sw: 100, sh: 100 });
  expect(coverRect(96, 96)).toEqual({ sx: 0, sy: 0, sw: 96, sh: 96 });
});

test('greyOut: luma grey and 60 % alpha, in place', () => {
  const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 100]);
  greyOut(pixels);
  expect([...pixels]).toEqual([76, 76, 76, 153, 29, 29, 29, 60]);
});

test('MAP_LAYER_STACK: Life360 members next to the hunters, their accuracy in the bottom group', () => {
  const groupOf = (id: string) => MAP_LAYER_STACK.findIndex((group) => group.includes(id));
  expect(groupOf(LIFE360_LAYER)).toBe(groupOf(HUNTERS_LAYER));
  expect(groupOf(LIFE360_HOVER_LAYER)).toBe(groupOf('hunters-hover'));
  expect(groupOf(LIFE360_ACCURACY_LAYER)).toBe(0);
});
