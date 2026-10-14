import { describe, expect, test } from 'bun:test';
import {
  broadcastMeta,
  DEFAULT_EXPIRY,
  DEFAULT_MAX_USES,
  EXPIRY_OPTIONS,
  formatTimeLeft,
  inviteMeta,
  inviteShareText,
  inviteStateText,
  inviteUses,
  isActiveNow,
  MAX_USES_OPTIONS,
  passkeyText,
  splitUsers,
  stoppedInviteMeta,
  userActivity,
  usersSummary,
  whatsAppShareUrl,
  type AdminInvite,
} from './beheer';

const now = Date.parse('2026-10-17T12:00:00Z');
const ago = (ms: number) => new Date(now - ms).toISOString();
const inMs = (ms: number) => new Date(now + ms).toISOString();
const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const invite = (overrides: Partial<AdminInvite> = {}): AdminInvite => ({
  _id: 'i1',
  code: 'ABCD2345',
  url: 'https://example.test/invite/ABCD2345',
  createdBy: { _id: 'u1', name: 'Silke' },
  createdAt: ago(HOUR),
  expiresAt: inMs(6 * HOUR),
  maxUses: 25,
  uses: 7,
  revokedAt: null,
  state: 'active',
  ...overrides,
});

describe('options', () => {
  test('expiry options in order with Dutch labels, default 1 dag', () => {
    expect(EXPIRY_OPTIONS).toEqual([
      { value: '30m', label: '30 minuten' },
      { value: '1h', label: '1 uur' },
      { value: '6h', label: '6 uur' },
      { value: '12h', label: '12 uur' },
      { value: '1d', label: '1 dag' },
      { value: '7d', label: '7 dagen' },
      { value: 'never', label: 'Nooit' },
    ]);
    expect(DEFAULT_EXPIRY).toBe('1d');
  });

  test('max uses options with Onbeperkt first, default unlimited', () => {
    expect(MAX_USES_OPTIONS).toEqual([
      { value: null, label: 'Onbeperkt' },
      { value: 1, label: '1 keer' },
      { value: 5, label: '5 keer' },
      { value: 10, label: '10 keer' },
      { value: 25, label: '25 keer' },
      { value: 50, label: '50 keer' },
      { value: 100, label: '100 keer' },
    ]);
    expect(DEFAULT_MAX_USES).toBeNull();
  });
});

describe('users', () => {
  test('passkeyText', () => {
    expect(passkeyText(undefined)).toBe('geen passkey');
    expect(passkeyText(0)).toBe('geen passkey');
    expect(passkeyText(1)).toBe('1 passkey');
    expect(passkeyText(2)).toBe('2 passkeys');
  });

  test('isActiveNow: active in the last 5 minutes', () => {
    expect(isActiveNow({ lastActiveAt: ago(5 * MIN - SEC) }, now)).toBe(true);
    expect(isActiveNow({ lastActiveAt: ago(5 * MIN) }, now)).toBe(false);
    expect(isActiveNow({ lastActiveAt: null }, now)).toBe(false);
    expect(isActiveNow({}, now)).toBe(false);
  });

  test('userActivity: never, now (under 5 min), else time ago', () => {
    expect(userActivity({ lastActiveAt: null }, now)).toBe('nooit actief');
    expect(userActivity({}, now)).toBe('nooit actief');
    expect(userActivity({ lastActiveAt: ago(MIN) }, now)).toBe('nu actief');
    expect(userActivity({ lastActiveAt: ago(5 * MIN) }, now)).toBe('5 min geleden');
    expect(userActivity({ lastActiveAt: ago(3 * DAY) }, now)).toBe('3 dagen geleden');
  });

  test('usersSummary: accounts and how many are active now', () => {
    expect(usersSummary([{ lastActiveAt: ago(MIN) }, { lastActiveAt: ago(HOUR) }, {}], now)).toBe('3 accounts · 1 nu actief');
    expect(usersSummary([{ lastActiveAt: null }], now)).toBe('1 account · 0 nu actief');
    expect(usersSummary([], now)).toBe('0 accounts · 0 nu actief');
  });
});

describe('formatTimeLeft', () => {
  test('minutes, hours, days, past', () => {
    expect(formatTimeLeft(inMs(59 * SEC), now)).toBe('nog 1 min');
    expect(formatTimeLeft(inMs(52 * MIN), now)).toBe('nog 52 min');
    expect(formatTimeLeft(inMs(90 * MIN), now)).toBe('nog 1 uur');
    expect(formatTimeLeft(inMs(47 * HOUR), now)).toBe('nog 47 uur');
    expect(formatTimeLeft(inMs(3 * DAY), now)).toBe('nog 3 dagen');
    expect(formatTimeLeft(ago(MIN), now)).toBe('verlopen');
    expect(formatTimeLeft(inMs(0), now)).toBe('verlopen');
  });
});

describe('inviteMeta', () => {
  test('active invites', () => {
    expect(inviteMeta(invite(), now)).toBe('7 van 25 gebruikt · nog 6 uur · Silke');
    expect(inviteMeta(invite({ maxUses: 1, uses: 0, expiresAt: inMs(52 * MIN) }), now)).toBe('Eenmalig · nog 52 min · Silke');
    expect(inviteMeta(invite({ maxUses: null, uses: 14, expiresAt: null, createdBy: { _id: 'u2', name: 'Mark' } }), now)).toBe(
      '14 gebruikt · verloopt nooit · Mark',
    );
  });

  test('stopped invites show their state instead of the time left', () => {
    expect(inviteMeta(invite({ maxUses: 3, uses: 3, state: 'full' }), now)).toBe('3 van 3 gebruikt · vol · Silke');
    expect(inviteMeta(invite({ maxUses: 1, uses: 1, state: 'full' }), now)).toBe('Gebruikt · vol · Silke');
    expect(inviteMeta(invite({ expiresAt: ago(HOUR), state: 'expired' }), now)).toBe('7 van 25 gebruikt · verlopen · Silke');
    expect(inviteMeta(invite({ revokedAt: ago(MIN), state: 'revoked' }), now)).toBe('7 van 25 gebruikt · ingetrokken · Silke');
  });

  test('no creator', () => {
    expect(inviteMeta(invite({ createdBy: null }), now)).toBe('7 van 25 gebruikt · nog 6 uur');
  });
});

describe('broadcastMeta', () => {
  test('sender (or HQ) and Dutch clock time', () => {
    expect(broadcastMeta({ id: 'b1', body: 'x', data: { from: 'Silke' }, createdAt: '2026-10-17T09:42:00Z' })).toBe('Silke · 11:42');
    expect(broadcastMeta({ id: 'b2', body: 'x', data: {}, createdAt: '2026-10-17T09:42:00Z' })).toBe('HQ · 11:42');
  });
});

describe('splitUsers', () => {
  test('admins and members, each sorted by name', () => {
    const users = [
      { name: 'Zoë', admin: false },
      { name: 'mark', admin: true },
      { name: 'Anna', admin: false },
      { name: 'Silke', admin: true },
      { name: 'Émile', admin: false },
    ];
    const { admins, members } = splitUsers(users);
    expect(admins.map((user) => user.name)).toEqual(['mark', 'Silke']);
    expect(members.map((user) => user.name)).toEqual(['Anna', 'Émile', 'Zoë']);
  });
});

describe('invite rows and sharing', () => {
  test('inviteUses', () => {
    expect(inviteUses(invite({ maxUses: 1, uses: 0 }))).toBe('Eenmalig');
    expect(inviteUses(invite({ maxUses: 1, uses: 1 }))).toBe('Gebruikt');
    expect(inviteUses(invite({ maxUses: 25, uses: 7 }))).toBe('7 van 25 gebruikt');
    expect(inviteUses(invite({ maxUses: null, uses: 3 }))).toBe('3 gebruikt');
  });

  test('inviteStateText', () => {
    expect(inviteStateText('expired')).toBe('verlopen');
    expect(inviteStateText('revoked')).toBe('ingetrokken');
    expect(inviteStateText('full')).toBe('vol');
  });

  test('stoppedInviteMeta leaves the state out (it shows as a pill)', () => {
    expect(stoppedInviteMeta(invite({ state: 'full', maxUses: 3, uses: 3 }))).toBe('3 van 3 gebruikt · Silke');
    expect(stoppedInviteMeta(invite({ state: 'revoked', createdBy: null, maxUses: null, uses: 2 }))).toBe('2 gebruikt');
  });

  test('whatsAppShareUrl encodes the whole message', () => {
    expect(whatsAppShareUrl('Hoi & welkom: https://x.test/invite/AB?c=1')).toBe('https://wa.me/?text=Hoi%20%26%20welkom%3A%20https%3A%2F%2Fx.test%2Finvite%2FAB%3Fc%3D1');
  });

  test('inviteShareText ends with the link', () => {
    expect(inviteShareText('https://example.test/invite/ABCD2345')).toBe('Maak met deze link een account voor onze Jotihunt-app: https://example.test/invite/ABCD2345');
  });
});
