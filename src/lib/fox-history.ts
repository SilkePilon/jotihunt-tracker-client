import { formatClock, formatCountdown } from './format';
import type { SidebarFox } from './fox-status';

/** `GET /areas/:area/history`: what happened to one fox in a time window (ISO times; `to` null = still running). */
export interface AreaHistory {
  area: string;
  from: string;
  to: string;
  status: { status: 'green' | 'orange' | 'red' | 'blue'; from: string; to: string | null }[];
  hints: { articleId: number; publishAt: string; solvedAt: string | null; title: string }[];
  spots: { id: string; at: string }[];
  hunts: { id: string; at: string; result: 'approved' | 'pending' | 'rejected' }[];
}

/** The history panel always shows the last three hours. */
export const HISTORY_WINDOW_MIN = 180;

export type LaneKey = 'status' | 'hint' | 'spot' | 'hunt';
export const LANES: LaneKey[] = ['status', 'hint', 'spot', 'hunt'];

export type BlockKind = 'green' | 'orange' | 'red' | 'blue' | 'think' | 'solid' | 'wait' | 'fail';

/** One block on a lane; `start`/`end` in minutes after the window start, `end` null = still running. */
export interface HistoryBlock {
  id: string;
  lane: LaneKey;
  kind: BlockKind;
  start: number;
  end: number | null;
  icon?: 'check' | 'x';
  card: { title: string; meta: string; note?: string };
}

/** A branch line from the status lane down to `lane` at `out` and back up at `back` (null = not back yet). */
export interface HistoryLink {
  id: string;
  lane: LaneKey;
  out: number;
  back: number | null;
}

/** The timeline of one fox: window in epoch ms, blocks and links in minutes after `from`. */
export interface HistoryModel {
  from: number;
  to: number;
  blocks: HistoryBlock[];
  links: HistoryLink[];
}

const MINUTE_MS = 60_000;
const HINT_SPOT_MIN = 5;
const SPOT_MIN = 8;
const HUNT_MIN = 7;
const REJECTED_MIN = 11;
const COOLDOWN_MIN = 60;

const STATUS_TITLE: Record<AreaHistory['status'][number]['status'], string> = {
  green: 'Groen: jagen mag',
  orange: 'Oranje: jagen mag',
  red: 'Rood: niet hunten',
  blue: 'Reist met OV',
};

const STATUS_WORD: Record<AreaHistory['status'][number]['status'], string> = { green: 'Groen', orange: 'Oranje', red: 'Rood', blue: 'OV' };

/** Time since something as "45m" or "1u05m" (whole minutes, rounded down, never negative). */
export function formatSince(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / MINUTE_MS));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}u${String(minutes % 60).padStart(2, '0')}m`;
}

/** Chip text after a fox's name: the cooldown countdown ("nog 32:00"), otherwise the time since its last status change. */
export function chipSinceText(fox: SidebarFox, now: number): string {
  if (fox.group === 'cooldown') return `nog ${formatCountdown(fox.cooldownMs)}`;
  return formatSince(now - Date.parse(fox.area.updatedAt));
}

/**
 * Lay out an area's history in the window `[now − 3 h, now]`. Blocks are cut at the window start (blocks that ended
 * before it are dropped); their ends are not capped at now (a running cooldown ends in the future, the renderer caps
 * it). Links that left before the window are dropped.
 */
export function historyModel(history: AreaHistory, now: number): HistoryModel {
  const from = now - HISTORY_WINDOW_MIN * MINUTE_MS;
  const blocks: HistoryBlock[] = [];
  const links: HistoryLink[] = [];
  const minutes = (iso: string) => (Date.parse(iso) - from) / MINUTE_MS;

  const addBlock = (block: HistoryBlock) => {
    if (block.start > HISTORY_WINDOW_MIN || (block.end !== null && block.end <= 0)) return;
    blocks.push({ ...block, start: Math.max(0, block.start) });
  };
  const addLink = (link: HistoryLink) => {
    if (link.out >= 0 && link.out <= HISTORY_WINDOW_MIN) links.push(link);
  };

  history.status.forEach((period, index) => {
    const startMs = Date.parse(period.from);
    const endMs = period.to === null ? null : Date.parse(period.to);
    addBlock({
      id: `status-${index}`,
      lane: 'status',
      kind: period.status,
      start: minutes(period.from),
      end: period.to === null ? null : minutes(period.to),
      card: {
        title: STATUS_TITLE[period.status],
        meta: `${formatClock(startMs)} – ${endMs === null ? 'nu' : formatClock(endMs)} · ${formatSince((endMs ?? now) - startMs)}`,
      },
    });
  });

  for (const hint of history.hints) {
    const id = `hint-${hint.articleId}`;
    const out = minutes(hint.publishAt);
    const publishMs = Date.parse(hint.publishAt);
    if (hint.solvedAt === null) {
      addBlock({ id, lane: 'hint', kind: 'think', start: out, end: null, card: { title: 'Hint: nog puzzelen', meta: `${formatSince(now - publishMs)} bezig`, note: hint.title } });
      addLink({ id, lane: 'hint', out, back: null });
      continue;
    }
    const solved = minutes(hint.solvedAt);
    const solvedMs = Date.parse(hint.solvedAt);
    addBlock({ id, lane: 'hint', kind: 'think', start: out, end: solved, card: { title: 'Hint opgelost', meta: `In ${formatSince(solvedMs - publishMs)}`, note: hint.title } });
    addBlock({ id: `${id}-spot`, lane: 'hint', kind: 'solid', start: solved, end: solved + HINT_SPOT_MIN, card: { title: 'Spot gezet', meta: formatClock(solvedMs) } });
    addLink({ id, lane: 'hint', out, back: solved + HINT_SPOT_MIN });
  }

  for (const spot of history.spots) {
    const id = `spot-${spot.id}`;
    const at = minutes(spot.at);
    addBlock({ id, lane: 'spot', kind: 'solid', start: at, end: at + SPOT_MIN, card: { title: 'Vos gezien', meta: formatClock(spot.at) } });
    addLink({ id, lane: 'spot', out: at, back: at + SPOT_MIN + 1 });
  }

  for (const hunt of history.hunts) {
    const id = `hunt-${hunt.id}`;
    const at = minutes(hunt.at);
    const atMs = Date.parse(hunt.at);
    if (hunt.result === 'rejected') {
      addBlock({ id, lane: 'hunt', kind: 'fail', start: at, end: at + REJECTED_MIN, icon: 'x', card: { title: 'Hunt afgekeurd', meta: formatClock(atMs), note: 'Geen cooldown' } });
      addLink({ id, lane: 'hunt', out: at, back: at + REJECTED_MIN + 1 });
      continue;
    }
    const freeMs = atMs + COOLDOWN_MIN * MINUTE_MS;
    const running = freeMs > now;
    addBlock({
      id,
      lane: 'hunt',
      kind: 'solid',
      start: at,
      end: at + HUNT_MIN,
      icon: 'check',
      card: { title: hunt.result === 'approved' ? 'Hunt goedgekeurd' : 'Hunt ingediend', meta: formatClock(atMs) },
    });
    addBlock({
      id: `${id}-wait`,
      lane: 'hunt',
      kind: 'wait',
      start: at + HUNT_MIN,
      end: at + COOLDOWN_MIN,
      card: {
        title: running ? 'Cooldown loopt' : 'Cooldown',
        // Round the countdown up: "Nog 0m" while still waiting would read as free.
        meta: running ? `Nog ${formatSince(Math.ceil((freeMs - now) / MINUTE_MS) * MINUTE_MS)}` : `${formatClock(atMs)} – ${formatClock(freeMs)}`,
        note: `Weer huntbaar ${formatClock(freeMs)}`,
      },
    });
    addLink({ id, lane: 'hunt', out: at, back: at + COOLDOWN_MIN });
  }

  return { from, to: now, blocks, links };
}

/**
 * Status line above the timeline: `word` "Rood · 2u05m" (the latest status and how long it has lasted), `rest`
 * "2 hunts · 4/4 hints" (approved + pending hunts, solved / published hints within the window).
 */
export function historyStatusLine(history: AreaHistory, now: number): { status: 'green' | 'orange' | 'red' | 'blue' | null; word: string; rest: string } {
  const from = now - HISTORY_WINDOW_MIN * MINUTE_MS;
  const inWindow = (iso: string) => {
    const ms = Date.parse(iso);
    return ms >= from && ms <= now;
  };
  const hunts = history.hunts.filter((hunt) => hunt.result !== 'rejected' && inWindow(hunt.at)).length;
  const published = history.hints.filter((hint) => inWindow(hint.publishAt));
  const solved = published.filter((hint) => hint.solvedAt !== null).length;
  const rest = `${hunts} ${hunts === 1 ? 'hunt' : 'hunts'} · ${solved}/${published.length} hints`;

  const current = history.status.at(-1);
  if (!current) return { status: null, word: 'Onbekend', rest };
  return { status: current.status, word: `${STATUS_WORD[current.status]} · ${formatSince(now - Date.parse(current.from))}`, rest };
}

/** Axis labels: window start, middle (Dutch clock) and "nu". */
export function axisTicks(from: number): [string, string, string] {
  return [formatClock(from), formatClock(from + (HISTORY_WINDOW_MIN / 2) * MINUTE_MS), 'nu'];
}
