import { describe, expect, test } from 'bun:test';
import type { Life360AdminStatus } from '@/types/Life360';
import type { TelegramAdminStatus } from '@/types/Telegram';
import { life360Integration, telegramIntegration } from './koppelingen';

const NOW = Date.parse('2026-10-17T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;

const telegram = (overrides: Partial<TelegramAdminStatus>): TelegramAdminStatus => ({ state: 'linked', connected: true, ...overrides });

describe('telegramIntegration', () => {
  test('not set up on the server', () => {
    expect(telegramIntegration(telegram({ state: 'unavailable' }), NOW)).toEqual({
      tone: 'off',
      pill: 'Niet gekoppeld',
      line: 'Niet ingesteld op de server (TELEGRAM_API_ID/HASH).',
      canLink: false,
      canUnlink: false,
      canRelink: false,
    });
  });

  test('unlinked: what it does, Koppelen', () => {
    const view = telegramIntegration(telegram({ state: 'unlinked' }), NOW);
    expect(view).toMatchObject({ tone: 'off', pill: 'Niet gekoppeld', canLink: true, canUnlink: false });
    expect(view.line).toBe('Leest berichten van @Jotihunt_bot: tegenhunts en happy hours worden automatisch gemeld.');
  });

  test('linking steps', () => {
    expect(telegramIntegration(telegram({ state: 'qr' }), NOW)).toMatchObject({ tone: 'off', line: 'Bezig met koppelen…', canLink: false, canUnlink: false });
    expect(telegramIntegration(telegram({ state: 'password' }), NOW)).toMatchObject({ line: 'Bezig met koppelen…' });
  });

  test('linked and connected: who, last message, Ontkoppelen', () => {
    const view = telegramIntegration(telegram({ account: { name: 'Silke', username: 'silke' }, lastMessageAt: ago(3 * MIN) }), NOW);
    expect(view).toEqual({
      tone: 'ok',
      pill: 'Verbonden',
      line: 'Gekoppeld als Silke (@silke)',
      sync: 'Laatste bericht van @Jotihunt_bot 3 min geleden',
      canLink: false,
      canUnlink: true,
      canRelink: false,
    });
    expect(telegramIntegration(telegram({ account: { name: 'Silke', phoneMasked: '+31 6 •••• 4821' } }), NOW)).toMatchObject({
      line: 'Gekoppeld als Silke (+31 6 •••• 4821)',
      sync: 'Nog geen berichten van @Jotihunt_bot',
    });
    expect(telegramIntegration(telegram({}), NOW).line).toBe('Gekoppeld als Telegram');
  });

  test('linked but not connected: attention with the server error', () => {
    expect(telegramIntegration(telegram({ connected: false, account: { name: 'Silke' }, lastError: 'Sessie verlopen.' }), NOW)).toEqual({
      tone: 'warn',
      pill: 'Aandacht nodig',
      line: 'Gekoppeld als Silke',
      problem: 'Sessie verlopen.',
      canLink: false,
      canUnlink: true,
      canRelink: false,
    });
    expect(telegramIntegration(telegram({ connected: false }), NOW).problem).toBe('Geen verbinding met Telegram. De server probeert het opnieuw.');
  });
});

describe('life360Integration', () => {
  test('not set up, unlinked, linking', () => {
    expect(life360Integration({ state: 'unavailable' }, NOW)).toMatchObject({ tone: 'off', line: 'Niet ingesteld op de server (LIFE360_SESSION_KEY).', canLink: false });
    expect(life360Integration({ state: 'unlinked' }, NOW)).toMatchObject({
      tone: 'off',
      pill: 'Niet gekoppeld',
      line: 'Iedereen in de team-cirkel verschijnt als eigen laag op de kaart.',
      canLink: true,
    });
    expect(life360Integration({ state: 'code', email: 'a@b.nl', resendAt: ago(0) }, NOW)).toMatchObject({ line: 'Bezig met koppelen…', canLink: false, canUnlink: false });
    expect(life360Integration({ state: 'circle', email: 'a@b.nl', circles: [] }, NOW)).toMatchObject({ line: 'Bezig met koppelen…' });
  });

  test('linked: who, live line, Ontkoppelen', () => {
    const status: Life360AdminStatus = { state: 'linked', email: 'team@x.nl', circleName: 'Jotihunt 2026', memberCount: 6, liveCount: 4, lastPollAt: ago(12_000), refreshAvailableAt: null };
    expect(life360Integration(status, NOW)).toEqual({
      tone: 'ok',
      pill: 'Verbonden',
      line: 'Gekoppeld als team@x.nl · Jotihunt 2026',
      sync: '4 van 6 live · 12 s geleden',
      canLink: false,
      canUnlink: true,
      canRelink: false,
    });
  });

  test('paused: attention with the retry time, still Ontkoppelen', () => {
    const status: Life360AdminStatus = { state: 'paused', email: 'team@x.nl', circleName: 'Jotihunt 2026', retryAt: '2026-10-17T12:30:00Z', memberCount: 6, liveCount: 0 };
    expect(life360Integration(status, NOW)).toEqual({
      tone: 'warn',
      pill: 'Aandacht nodig',
      line: 'Gekoppeld als team@x.nl · Jotihunt 2026',
      problem: 'Life360 vraagt ons te wachten. Volgende poging om 14:30.',
      canLink: false,
      canUnlink: true,
      canRelink: false,
    });
  });

  test('logged out: attention, Opnieuw koppelen', () => {
    expect(life360Integration({ state: 'loggedOut', email: 'team@x.nl', circleName: 'Jotihunt 2026' }, NOW)).toEqual({
      tone: 'warn',
      pill: 'Aandacht nodig',
      line: 'Gekoppeld als team@x.nl · Jotihunt 2026',
      problem: 'Life360 heeft de sessie beëindigd. Laatste posities blijven grijs op de kaart.',
      canLink: false,
      canUnlink: false,
      canRelink: true,
    });
  });
});
