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

/** Above this the elapsed time reads "24u+": after a day the exact time no longer matters. */
const SINCE_CAP_MIN = 24 * 60;

/**
 * Time since a fox's last status change for the chip and the history status line: "1u05m", "24u+" after a day; null in
 * a read-only (archive) edition, where the time since the last change is meaningless.
 */
export function statusSinceText(updatedAt: string, now: number, readOnly = false): string | null {
  if (readOnly) return null;
  const ms = now - Date.parse(updatedAt);
  return ms > SINCE_CAP_MIN * MINUTE_MS ? `${SINCE_CAP_MIN / 60}u+` : formatSince(ms);
}

/** Chip text after a fox's name: the cooldown countdown ("32:00", as before), otherwise the time since its last status change (null = none). */
export function chipSinceText(fox: SidebarFox, now: number, readOnly = false): string | null {
  if (fox.group === 'cooldown') return formatCountdown(fox.cooldownMs);
  return statusSinceText(fox.area.updatedAt, now, readOnly);
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

type FoxStatus = AreaHistory['status'][number]['status'];

/**
 * Status line above the timeline. `word` "Rood · 2u05m" comes from the local fox data (its status and the time since
 * `updatedAt`, same as the chip), so it shows while the history loads or after a failed fetch. `rest` "2 hunts · 4/4
 * hints" (approved + pending hunts, solved / published hints within the window) needs the history; null without it.
 */
export function historyStatusLine(
  area: { status: string; updatedAt: string },
  history: AreaHistory | undefined,
  now: number,
  readOnly = false,
): { status: FoxStatus | null; word: string; rest: string | null } {
  const status = Object.hasOwn(STATUS_WORD, area.status) ? (area.status as FoxStatus) : null;
  const since = statusSinceText(area.updatedAt, now, readOnly);
  const label = status ? STATUS_WORD[status] : 'Onbekend';
  const word = status && since ? `${label} · ${since}` : label;
  if (!history) return { status, word, rest: null };

  const from = now - HISTORY_WINDOW_MIN * MINUTE_MS;
  const inWindow = (iso: string) => {
    const ms = Date.parse(iso);
    return ms >= from && ms <= now;
  };
  const hunts = history.hunts.filter((hunt) => hunt.result !== 'rejected' && inWindow(hunt.at)).length;
  const published = history.hints.filter((hint) => inWindow(hint.publishAt));
  const solved = published.filter((hint) => hint.solvedAt !== null).length;
  return { status, word, rest: `${hunts} ${hunts === 1 ? 'hunt' : 'hunts'} · ${solved}/${published.length} hints` };
}

/** Axis labels: window start, middle (Dutch clock) and "nu". */
export function axisTicks(from: number): [string, string, string] {
  return [formatClock(from), formatClock(from + (HISTORY_WINDOW_MIN / 2) * MINUTE_MS), 'nu'];
}

/** A block as laid out in the plot (px): its horizontal span and its lane's centre line */
export interface PlacedBlock {
  id: string;
  left: number;
  right: number;
  centreY: number;
}

/**
 * Touch: the block nearest to a tap at (x, y), within `radius` px (22 = a 44 px target around the 12 px blocks); null
 * when nothing is that close. Inside a block's span counts as 0 horizontally, so a tap between rows picks the nearer one.
 */
export function nearestBlock(blocks: readonly PlacedBlock[], x: number, y: number, radius: number): string | null {
  let best: { id: string; distance: number } | null = null;
  for (const block of blocks) {
    const dx = x < block.left ? block.left - x : x > block.right ? x - block.right : 0;
    const dy = Math.abs(y - block.centreY);
    if (dx > radius || dy > radius) continue;
    const distance = Math.hypot(dx, dy);
    if (!best || distance < best.distance) best = { id: block.id, distance };
  }
  return best?.id ?? null;
}

/** Arrow keys between blocks (roving tabindex): Left/Right along a lane, Up/Down to the nearest block in the next lane with blocks. */
export type BlockKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

const BLOCK_KEYS = new Set<string>(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);
export const isBlockKey = (key: string): key is BlockKey => BLOCK_KEYS.has(key);

const blockMiddle = (block: HistoryBlock) => (block.start + Math.min(block.end ?? HISTORY_WINDOW_MIN, HISTORY_WINDOW_MIN)) / 2;

function laneBlocks(blocks: readonly HistoryBlock[], lane: LaneKey): HistoryBlock[] {
  return blocks.filter((block) => block.lane === lane).sort((a, b) => a.start - b.start);
}

/**
 * The timeline's one Tab stop when none was picked yet (or the picked block is gone): the latest block of the first lane
 * that has any, i.e. normally the current status. null without blocks.
 */
export function defaultTabStop(blocks: readonly HistoryBlock[]): string | null {
  for (const lane of LANES) {
    const row = laneBlocks(blocks, lane);
    if (row.length) return row[row.length - 1].id;
  }
  return null;
}

/**
 * Where an arrow key moves the focus from block `currentId`: Left/Right to the previous/next block on its lane, Home/End
 * to its lane's first/last block, Up/Down to the block nearest in time on the closest lane above/below that has blocks.
 * null when there is nowhere to go (the focus stays).
 */
export function blockKeyTarget(blocks: readonly HistoryBlock[], currentId: string, key: BlockKey): string | null {
  const current = blocks.find((block) => block.id === currentId);
  if (!current) return null;
  const row = laneBlocks(blocks, current.lane);
  const index = row.findIndex((block) => block.id === currentId);
  switch (key) {
    case 'ArrowLeft':
      return row[index - 1]?.id ?? null;
    case 'ArrowRight':
      return row[index + 1]?.id ?? null;
    case 'Home':
      return index > 0 ? row[0].id : null;
    case 'End':
      return index < row.length - 1 ? row[row.length - 1].id : null;
  }
  const step = key === 'ArrowUp' ? -1 : 1;
  const middle = blockMiddle(current);
  for (let lane = LANES.indexOf(current.lane) + step; lane >= 0 && lane < LANES.length; lane += step) {
    const candidates = laneBlocks(blocks, LANES[lane]);
    if (!candidates.length) continue;
    return candidates.reduce((best, block) => (Math.abs(blockMiddle(block) - middle) < Math.abs(blockMiddle(best) - middle) ? block : best)).id;
  }
  return null;
}
