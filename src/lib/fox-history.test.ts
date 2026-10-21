import { describe, expect, test } from 'bun:test';
import type { SidebarFox } from './fox-status';
import { axisTicks, chipSinceText, formatSince, historyModel, historyStatusLine, type AreaHistory } from './fox-history';

const MIN = 60_000;
// 18:40 Amsterdam; the window runs 15:40 – 18:40.
const now = Date.parse('2026-10-18T18:40:00+02:00');
const from = now - 180 * MIN;
const iso = (minutesAfterFrom: number) => new Date(from + minutesAfterFrom * MIN).toISOString();

function history(overrides: Partial<AreaHistory> = {}): AreaHistory {
  return { area: 'alpha', from: iso(0), to: iso(180), status: [], hints: [], spots: [], hunts: [], ...overrides };
}

describe('historyModel', () => {
  test('window is the last 180 minutes before now', () => {
    const model = historyModel(history(), now);
    expect(model.from).toBe(from);
    expect(model.to).toBe(now);
    expect(model.blocks).toEqual([]);
    expect(model.links).toEqual([]);
  });

  test('status periods: clipped at the window start, the running one has end null', () => {
    const model = historyModel(
      history({
        status: [
          { status: 'green', from: iso(-30), to: iso(55) },
          { status: 'red', from: iso(55), to: null },
        ],
      }),
      now,
    );
    expect(model.blocks).toHaveLength(2);
    expect(model.blocks[0]).toMatchObject({ lane: 'status', kind: 'green', start: 0, end: 55 });
    expect(model.blocks[0].card.title).toBe('Groen: jagen mag');
    expect(model.blocks[0].card.meta).toBe('15:10 – 16:35 · 1u25m');
    expect(model.blocks[1]).toMatchObject({ lane: 'status', kind: 'red', start: 55, end: null });
    expect(model.blocks[1].card).toEqual({ title: 'Rood: niet hunten', meta: '16:35 – nu · 2u05m' });
  });

  test('status titles for orange and OV; periods ended before the window are dropped', () => {
    const model = historyModel(
      history({
        status: [
          { status: 'green', from: iso(-90), to: iso(-10) },
          { status: 'orange', from: iso(-10), to: iso(20) },
          { status: 'blue', from: iso(20), to: null },
        ],
      }),
      now,
    );
    expect(model.blocks.map((b) => [b.kind, b.card.title])).toEqual([
      ['orange', 'Oranje: jagen mag'],
      ['blue', 'Reist met OV'],
    ]);
  });

  test('open hint: running think block and a link without return', () => {
    const model = historyModel(history({ hints: [{ articleId: 7, publishAt: iso(142), solvedAt: null, title: 'Hint 18:00' }] }), now);
    expect(model.blocks).toEqual([
      { id: 'hint-7', lane: 'hint', kind: 'think', start: 142, end: null, card: { title: 'Hint: nog puzzelen', meta: '38m bezig', note: 'Hint 18:00' } },
    ]);
    expect(model.links).toEqual([{ id: 'hint-7', lane: 'hint', out: 142, back: null }]);
  });

  test('solved hint: think block, 5-minute spot block and a link back after it', () => {
    const model = historyModel(history({ hints: [{ articleId: 3, publishAt: iso(20), solvedAt: iso(43), title: 'Hint 16:00' }] }), now);
    expect(model.blocks).toEqual([
      { id: 'hint-3', lane: 'hint', kind: 'think', start: 20, end: 43, card: { title: 'Hint opgelost', meta: 'In 23m', note: 'Hint 16:00' } },
      { id: 'hint-3-spot', lane: 'hint', kind: 'solid', start: 43, end: 48, card: { title: 'Spot gezet', meta: '16:23' } },
    ]);
    expect(model.links).toEqual([{ id: 'hint-3', lane: 'hint', out: 20, back: 48 }]);
  });

  test('hint published before the window: think block clipped, no link', () => {
    const model = historyModel(history({ hints: [{ articleId: 2, publishAt: iso(-20), solvedAt: iso(10), title: 'Hint 15:00' }] }), now);
    expect(model.blocks.map((b) => [b.id, b.start, b.end])).toEqual([
      ['hint-2', 0, 10],
      ['hint-2-spot', 10, 15],
    ]);
    expect(model.links).toEqual([]);
  });

  test('hint entirely before the window leaves nothing', () => {
    const model = historyModel(history({ hints: [{ articleId: 1, publishAt: iso(-60), solvedAt: iso(-20), title: 'Hint 14:00' }] }), now);
    expect(model.blocks).toEqual([]);
    expect(model.links).toEqual([]);
  });

  test('spot: 8-minute block, link back one minute later', () => {
    const model = historyModel(history({ spots: [{ id: 's1', at: iso(100) }] }), now);
    expect(model.blocks).toEqual([{ id: 'spot-s1', lane: 'spot', kind: 'solid', start: 100, end: 108, card: { title: 'Vos gezien', meta: '17:20' } }]);
    expect(model.links).toEqual([{ id: 'spot-s1', lane: 'spot', out: 100, back: 109 }]);
  });

  test('approved hunt with the cooldown still running past now', () => {
    const model = historyModel(history({ hunts: [{ id: 'h1', at: iso(150), result: 'approved' }] }), now);
    expect(model.blocks).toEqual([
      { id: 'hunt-h1', lane: 'hunt', kind: 'solid', start: 150, end: 157, icon: 'check', card: { title: 'Hunt goedgekeurd', meta: '18:10' } },
      { id: 'hunt-h1-wait', lane: 'hunt', kind: 'wait', start: 157, end: 210, card: { title: 'Cooldown loopt', meta: 'Nog 30m', note: 'Weer huntbaar 19:10' } },
    ]);
    expect(model.links).toEqual([{ id: 'hunt-h1', lane: 'hunt', out: 150, back: 210 }]);
  });

  test('pending hunt with a finished cooldown', () => {
    const model = historyModel(history({ hunts: [{ id: 'h2', at: iso(50), result: 'pending' }] }), now);
    expect(model.blocks[0].card.title).toBe('Hunt ingediend');
    expect(model.blocks[1].card).toEqual({ title: 'Cooldown', meta: '16:30 – 17:30', note: 'Weer huntbaar 17:30' });
  });

  test('hunt before the window still shows the rest of its cooldown, without a link', () => {
    const model = historyModel(history({ hunts: [{ id: 'h3', at: iso(-30), result: 'approved' }] }), now);
    expect(model.blocks.map((b) => [b.id, b.start, b.end])).toEqual([['hunt-h3-wait', 0, 30]]);
    expect(model.links).toEqual([]);
  });

  test('rejected hunt: fail block with x, no cooldown', () => {
    const model = historyModel(history({ hunts: [{ id: 'h4', at: iso(60), result: 'rejected' }] }), now);
    expect(model.blocks).toEqual([
      { id: 'hunt-h4', lane: 'hunt', kind: 'fail', start: 60, end: 71, icon: 'x', card: { title: 'Hunt afgekeurd', meta: '16:40', note: 'Geen cooldown' } },
    ]);
    expect(model.links).toEqual([{ id: 'hunt-h4', lane: 'hunt', out: 60, back: 72 }]);
  });
});

describe('formatSince', () => {
  test('floored minutes, then hours with padded minutes', () => {
    expect(formatSince(0)).toBe('0m');
    expect(formatSince(59_999)).toBe('0m');
    expect(formatSince(45 * MIN)).toBe('45m');
    expect(formatSince(65 * MIN)).toBe('1u05m');
    expect(formatSince(125 * MIN + 30_000)).toBe('2u05m');
    expect(formatSince(-5000)).toBe('0m');
  });
});

describe('chipSinceText', () => {
  function fox(overrides: Partial<SidebarFox>): SidebarFox {
    return {
      area: { _id: 'a', name: 'alpha', status: 'red', updatedAt: new Date(now - 65 * MIN).toISOString() },
      key: 'alpha', name: 'Alpha', group: 'red', cooldownMs: 0, lastHunt: undefined, ...overrides,
    };
  }
  test('time since the last status change', () => {
    expect(chipSinceText(fox({}), now)).toBe('1u05m');
  });
  test('cooldown keeps the countdown', () => {
    expect(chipSinceText(fox({ group: 'cooldown', cooldownMs: 32 * MIN }), now)).toBe('nog 32:00');
  });
});

describe('historyStatusLine', () => {
  test('current status with its duration, hunts and hints in the window', () => {
    const line = historyStatusLine(
      history({
        status: [
          { status: 'green', from: iso(-30), to: iso(55) },
          { status: 'red', from: iso(55), to: null },
        ],
        hints: [
          { articleId: 1, publishAt: iso(-60), solvedAt: iso(-20), title: 'Hint 14:00' },
          { articleId: 2, publishAt: iso(20), solvedAt: iso(43), title: 'Hint 16:00' },
          { articleId: 3, publishAt: iso(80), solvedAt: iso(100), title: 'Hint 17:00' },
          { articleId: 4, publishAt: iso(142), solvedAt: null, title: 'Hint 18:00' },
        ],
        hunts: [
          { id: 'h0', at: iso(-30), result: 'approved' },
          { id: 'h1', at: iso(30), result: 'approved' },
          { id: 'h2', at: iso(150), result: 'pending' },
          { id: 'h3', at: iso(160), result: 'rejected' },
        ],
      }),
      now,
    );
    expect(line).toEqual({ status: 'red', word: 'Rood · 2u05m', rest: '2 hunts · 2/3 hints' });
  });

  test('singular hunt, other status words', () => {
    const line = historyStatusLine(history({ status: [{ status: 'blue', from: iso(170), to: null }], hunts: [{ id: 'h', at: iso(10), result: 'approved' }] }), now);
    expect(line).toEqual({ status: 'blue', word: 'OV · 10m', rest: '1 hunt · 0/0 hints' });
  });

  test('no status known', () => {
    expect(historyStatusLine(history(), now)).toEqual({ status: null, word: 'Onbekend', rest: '0 hunts · 0/0 hints' });
  });
});

describe('axisTicks', () => {
  test('window start, middle and now', () => {
    expect(axisTicks(from)).toEqual(['15:40', '17:10', 'nu']);
  });
});
