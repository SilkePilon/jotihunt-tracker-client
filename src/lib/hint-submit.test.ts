import { describe, expect, test } from 'bun:test';
import { hintPrimaryAction, holdsUnconfirmedHint, isSameMarker, sameDraft, lostResponseMessage, lostResponseOutcome, markerLostResponseMessage, isKnownOffline, OFFLINE_NOT_SENT_MESSAGE, type UnconfirmedHint } from './hint-submit';
import { MarkerType } from '@/types/MarkerType';
import type { Marker } from '@/types/Marker';

const sent: Marker = {
  area: 'Alpha',
  time: new Date('2026-10-17T12:00:00.000Z'),
  location: { type: 'Point', coordinates: [5.123456789, 52.987654321] },
  type: MarkerType.Hint,
};

/** As the server answers: time as an ISO string, an id, coordinates through a float round-trip */
const fromServer = (overrides: Partial<Marker> & { time?: Date | string } = {}): Marker =>
  ({ ...sent, _id: 'm1', time: '2026-10-17T12:00:00.000Z', location: { type: 'Point', coordinates: [5.123456789 + 1e-12, 52.987654321 - 1e-12] }, ...overrides }) as Marker;

describe('isSameMarker', () => {
  test('matches the hint the server saved (string time, float round-trip)', () => {
    expect(isSameMarker(fromServer(), sent)).toBe(true);
  });

  test('another area, hour, spot or marker type is not it', () => {
    expect(isSameMarker(fromServer({ area: 'Bravo' }), sent)).toBe(false);
    expect(isSameMarker(fromServer({ time: '2026-10-17T13:00:00.000Z' }), sent)).toBe(false);
    expect(isSameMarker(fromServer({ location: { type: 'Point', coordinates: [5.2, 52.98765432] } }), sent)).toBe(false);
    expect(isSameMarker(fromServer({ type: MarkerType.Hunt }), sent)).toBe(false);
  });

  test('a marker without a valid time or location is not it', () => {
    expect(isSameMarker(fromServer({ time: 'nonsense' }), sent)).toBe(false);
    expect(isSameMarker({ ...fromServer(), location: undefined } as unknown as Marker, sent)).toBe(false);
  });
});

describe('lostResponseOutcome', () => {
  test('the hint in the fresh list: it was registered after all', () => {
    expect(lostResponseOutcome([fromServer({ area: 'Bravo', _id: 'm0' }), fromServer()], sent)).toBe('registered');
  });

  test('a fresh list without it: absent', () => {
    expect(lostResponseOutcome([], sent)).toBe('absent');
    expect(lostResponseOutcome([fromServer({ area: 'Bravo' })], sent)).toBe('absent');
  });

  test('no fresh list (still offline): unknown', () => {
    expect(lostResponseOutcome(undefined, sent)).toBe('unknown');
  });
});

describe('a lost Hunt/Spot', () => {
  const hunt: Marker = { ...sent, type: MarkerType.Hunt, time: new Date('2026-10-17T12:34:00.000Z') };
  const savedHunt = fromServer({ type: MarkerType.Hunt, time: '2026-10-17T12:34:00.000Z' });

  test('found in the fresh list by type, area, time and spot', () => {
    expect(lostResponseOutcome([savedHunt], hunt)).toBe('registered');
  });

  test('a spot or hint at the same place and time is not the hunt', () => {
    expect(lostResponseOutcome([{ ...savedHunt, type: MarkerType.Spot }, { ...savedHunt, type: MarkerType.Hint }], hunt)).toBe('absent');
    expect(lostResponseOutcome([fromServer({ type: MarkerType.Hunt, time: '2026-10-17T12:35:00.000Z' })], hunt)).toBe('absent');
  });

  test('messages', () => {
    expect(markerLostResponseMessage('unknown')).toStartWith('Geen antwoord ontvangen. Misschien is de hunt toch geplaatst');
    expect(markerLostResponseMessage('unknown')).toContain('controleer het opnieuw');
    expect(markerLostResponseMessage('absent')).toContain('niet geplaatst');
    // Says what it is: hunt or spot, never "marker"
    expect(markerLostResponseMessage('absent', MarkerType.Spot)).toStartWith('Geen antwoord ontvangen en de spot staat niet op de kaart');
    expect(markerLostResponseMessage('unknown', MarkerType.Hunt)).not.toContain('marker');
  });
});

describe('lostResponseMessage', () => {
  test('unknown asks to check the map first; absent says it is not registered', () => {
    expect(lostResponseMessage('unknown')).toStartWith('Geen antwoord ontvangen. Controleer eerst of de hint op de kaart staat');
    expect(lostResponseMessage('absent')).toContain('niet geregistreerd');
  });
});

describe('sameDraft', () => {
  const draft = { area: 'Alpha', time: '2026-10-17T12:00', x: '123456', y: '456789' };
  test('unchanged while Registreren ran', () => {
    expect(sameDraft({ ...draft }, draft)).toBe(true);
  });
  test('any field changed means new input', () => {
    for (const key of ['area', 'time', 'x', 'y'] as const) expect(sameDraft({ ...draft, [key]: '' }, draft)).toBe(false);
  });
});

describe('holdsUnconfirmedHint', () => {
  const pending: UnconfirmedHint = { sent, values: { area: 'Alpha', time: '2026-10-17T12:00', x: '123456', y: '456789' }, outcome: 'unknown' };

  test('a poll holding our own lost hint is the late success', () => {
    expect(holdsUnconfirmedHint([fromServer({ area: 'Bravo' }), fromServer()], pending)).toBe(true);
  });

  test("someone else's hint for that hour (another spot) is not ours", () => {
    expect(holdsUnconfirmedHint([fromServer({ location: { type: 'Point', coordinates: [5.3, 52.1] } })], pending)).toBe(false);
  });

  test('nothing pending or no list: false', () => {
    expect(holdsUnconfirmedHint([fromServer()], null)).toBe(false);
    expect(holdsUnconfirmedHint(undefined, pending)).toBe(false);
  });
});

describe('hintPrimaryAction', () => {
  const values = { area: 'Alpha', time: '2026-10-17T12:00', x: '123456', y: '456789' };

  test('unknown outcome with the same values: Opnieuw controleren', () => {
    expect(hintPrimaryAction({ sent, values, outcome: 'unknown' }, { ...values })).toBe('recheck');
  });

  test('absent outcome, nothing pending, or a different hint typed: Registreren', () => {
    expect(hintPrimaryAction({ sent, values, outcome: 'absent' }, values)).toBe('register');
    expect(hintPrimaryAction(null, values)).toBe('register');
    expect(hintPrimaryAction({ sent, values, outcome: 'unknown' }, { ...values, x: '123457' })).toBe('register');
  });
});

describe('offline at submit', () => {
  test('only a known "offline" counts', () => {
    expect(isKnownOffline({ onLine: false })).toBe(true);
    expect(isKnownOffline({ onLine: true })).toBe(false);
    expect(isKnownOffline(undefined)).toBe(false);
  });

  test('the message says nothing went out and the input stays', () => {
    expect(OFFLINE_NOT_SENT_MESSAGE).toBe('Je bent offline — niet verstuurd. Je invoer blijft staan.');
  });
});
