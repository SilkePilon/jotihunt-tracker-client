import { describe, expect, test } from 'bun:test';
import { placeCard } from './placement';

const viewport = { width: 1280, height: 800 };
const card = { width: 340, height: 200 };

describe('placeCard', () => {
  test('no target: centered', () => {
    expect(placeCard({ target: null, card, viewport, isMobile: false })).toEqual({ x: 470, y: 300 });
  });

  test('left sidebar section: card goes to the right of it, vertically centered', () => {
    const target = { x: 8, y: 100, width: 320, height: 100 };
    expect(placeCard({ target, card, viewport, isMobile: false })).toEqual({ x: 340, y: 50 });
  });

  test('clamped inside the viewport', () => {
    const target = { x: 8, y: 0, width: 320, height: 40 };
    expect(placeCard({ target, card, viewport, isMobile: false }).y).toBe(12);
  });

  test('explicit placement that does not fit falls back to auto', () => {
    const target = { x: 8, y: 100, width: 320, height: 100 };
    expect(placeCard({ target, card, viewport, placement: 'left', isMobile: false }).x).toBe(340);
  });

  test('explicit placement that fits is honored over auto order', () => {
    const target = { x: 400, y: 100, width: 200, height: 100 };
    expect(placeCard({ target, card, viewport, placement: 'bottom', isMobile: false })).toEqual({ x: 330, y: 212 });
  });

  test('full-screen target (map): centered over it', () => {
    const target = { x: 0, y: 0, width: 1280, height: 800 };
    expect(placeCard({ target, card, viewport, isMobile: false })).toEqual({ x: 470, y: 300 });
  });

  test('mobile, target in bottom half: card docks at the top', () => {
    const phone = { width: 390, height: 844 };
    const target = { x: 0, y: 600, width: 390, height: 100 };
    expect(placeCard({ target, card: { width: 366, height: 180 }, viewport: phone, isMobile: true })).toEqual({ x: 12, y: 12 });
  });

  test('mobile, target in top half: card docks at the bottom', () => {
    const phone = { width: 390, height: 844 };
    const target = { x: 0, y: 40, width: 390, height: 60 };
    expect(placeCard({ target, card: { width: 366, height: 180 }, viewport: phone, isMobile: true })).toEqual({ x: 12, y: 652 });
  });
});
