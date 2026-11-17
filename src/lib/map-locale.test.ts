import { expect, test } from 'bun:test';
import { MAP_LOCALE_NL } from './map-locale';

test('the Dutch map locale covers the controls the app shows', () => {
  for (const key of ['NavigationControl.ZoomIn', 'NavigationControl.ZoomOut', 'FullscreenControl.Enter', 'FullscreenControl.Exit', 'GeolocateControl.FindMyLocation', 'AttributionControl.ToggleAttribution', 'Popup.Close']) {
    expect(MAP_LOCALE_NL[key]).toBeTruthy();
  }
});
