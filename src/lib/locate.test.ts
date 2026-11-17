import { describe, expect, test } from 'bun:test';
import { locateMe } from './locate';

function fakeGeolocation(result: { lat: number; lng: number } | { code: number }): Geolocation {
  return {
    getCurrentPosition: (success: PositionCallback, failure?: PositionErrorCallback | null) => {
      if ('lat' in result) success({ coords: { latitude: result.lat, longitude: result.lng } } as GeolocationPosition);
      else failure?.({ code: result.code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: '' } as GeolocationPositionError);
    },
  } as Geolocation;
}

describe('locateMe', () => {
  test('a fresh tracker position wins without asking the browser', async () => {
    expect(await locateMe({ lat: 52, lng: 5 }, fakeGeolocation({ code: 1 }))).toEqual({ lat: 52, lng: 5 });
  });

  test('falls back to the browser position', async () => {
    expect(await locateMe(undefined, fakeGeolocation({ lat: 51.9, lng: 6.1 }))).toEqual({ lat: 51.9, lng: 6.1 });
  });

  test('denied or unavailable: a Dutch message', async () => {
    expect(locateMe(undefined, fakeGeolocation({ code: 1 }))).rejects.toThrow('Geen toegang tot je locatie');
    expect(locateMe(undefined, fakeGeolocation({ code: 3 }))).rejects.toThrow('kon niet worden bepaald');
    expect(locateMe(undefined, undefined)).rejects.toThrow('kan je locatie niet bepalen');
  });
});
