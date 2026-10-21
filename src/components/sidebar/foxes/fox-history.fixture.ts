import { historyModel, type AreaHistory, type HistoryModel } from '@/lib/fox-history';

/**
 * Alpha from the approved mockup (`vos-historie-u3-kleuren.html`), relative to `now`: green before the window, then
 * orange, red since 2u05m; four hints (all solved), three spots, two approved hunts and (extra, to show every block
 * kind) a rejected one. For previews and the fake API of the browser check.
 */
export function foxHistoryFixture(now: number, area = 'alpha'): AreaHistory {
  // The mockup counts minutes from 12:00 with "now" at 400
  const at = (minute: number) => new Date(now + (minute - 400) * 60_000).toISOString();
  return {
    area,
    from: at(220),
    to: at(400),
    status: [
      { status: 'green', from: at(165), to: at(240) },
      { status: 'orange', from: at(240), to: at(275) },
      { status: 'red', from: at(275), to: null },
    ],
    hints: [
      { articleId: 1, publishAt: at(195), solvedAt: at(204), title: 'Hint 15:15' },
      { articleId: 2, publishAt: at(255), solvedAt: at(275), title: 'Hint 16:15' },
      { articleId: 3, publishAt: at(315), solvedAt: at(346), title: 'Hint 17:15' },
      { articleId: 4, publishAt: at(375), solvedAt: at(387), title: 'Hint 18:15' },
    ],
    spots: [
      { id: 's1', at: at(255) },
      { id: 's2', at: at(330) },
      { id: 's3', at: at(372) },
    ],
    hunts: [
      { id: 'h1', at: at(180), result: 'approved' },
      { id: 'h2', at: at(300), result: 'approved' },
      { id: 'h3', at: at(368), result: 'rejected' },
    ],
  };
}

/** The fixture laid out for the timeline. */
export function foxHistoryFixtureModel(now: number): HistoryModel {
  return historyModel(foxHistoryFixture(now), now);
}
