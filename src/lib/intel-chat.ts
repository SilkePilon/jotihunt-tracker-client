import { isAxiosError } from 'axios';
import type { ChatStatus, UIMessage } from 'ai';
import { areaStates } from '@/lib/intel-window';
import { areaOptions } from '@/lib/utils';
import type { IntelItem, IntelKind } from '@/types/Intel';
import type { ChatModes, HintAnswerProposal, IntelChatRequest, IntelToolName, PointResult, ToolTone, WebSearchResult } from '@/types/IntelChat';

/** Dutch running label and icon tone per tool (contract table) */
export const TOOL_META: Record<IntelToolName, { label: string; tone: ToolTone }> = {
  getItem: { label: 'Item lezen…', tone: 'app' },
  searchIntel: { label: 'Intel doorzoeken…', tone: 'app' },
  getHintBoard: { label: 'Hintbord bekijken…', tone: 'app' },
  getAreas: { label: 'Vossen bekijken…', tone: 'app' },
  getFoxHistory: { label: 'Geschiedenis vos bekijken…', tone: 'app' },
  getOurTeams: { label: 'Onze teams zoeken…', tone: 'app' },
  convertCoordinates: { label: 'Coördinaten omzetten…', tone: 'map' },
  checkPoint: { label: 'Punt checken…', tone: 'map' },
  nearbyGroups: { label: 'Groepen in de buurt zoeken…', tone: 'map' },
  distance: { label: 'Afstand meten…', tone: 'map' },
  projectPoint: { label: 'Punt uitrekenen…', tone: 'map' },
  geocode: { label: 'Plaats opzoeken…', tone: 'map' },
  reverseGeocode: { label: 'Adres opzoeken…', tone: 'map' },
  webSearch: { label: 'Zoeken op internet…', tone: 'web' },
  readWebPage: { label: 'Pagina lezen…', tone: 'web' },
  runCode: { label: 'Rekenen…', tone: 'think' },
  showPoint: { label: 'Punt klaarzetten…', tone: 'map' },
  proposeHintAnswer: { label: 'Antwoord klaarzetten…', tone: 'map' },
};

const isKnownTool = (name: string): name is IntelToolName => Object.hasOwn(TOOL_META, name);

/** "Punt checken…" while it runs; "Bezig…" for a tool this client doesn't know yet */
export function toolLabel(name: string): string {
  return isKnownTool(name) ? TOOL_META[name].label : 'Bezig…';
}

/** The label without the dots, for the finished list ("Punt checken"); an unknown tool shows its name */
export function toolDoneLabel(name: string): string {
  return isKnownTool(name) ? TOOL_META[name].label.replace(/…$/, '') : name;
}

export function toolTone(name: string): ToolTone {
  return isKnownTool(name) ? TOOL_META[name].tone : 'app';
}

export type ChatPart = UIMessage['parts'][number];

/** A tool call of an assistant message, flattened from its UI part */
export interface ChatToolCall {
  id: string;
  name: string;
  state: 'running' | 'done' | 'error';
  output?: unknown;
  errorText?: string;
}

const isObj = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** The tool call in a UI part (static `tool-<name>` or dynamic), or null for text, reasoning, files, step starts */
export function toolCallOf(part: ChatPart): ChatToolCall | null {
  let name: string;
  if (part.type === 'dynamic-tool') name = part.toolName;
  else if (part.type.startsWith('tool-')) name = part.type.slice('tool-'.length);
  else return null;
  const tool = part as unknown as { toolCallId: string; state: string; output?: unknown; errorText?: string };
  const id = tool.toolCallId;
  if (tool.state === 'output-available') {
    const output = tool.output;
    // Our tools return { error } instead of throwing (contract)
    if (isObj(output) && typeof output.error === 'string') return { id, name, state: 'error', output, errorText: output.error };
    return { id, name, state: 'done', output };
  }
  if (tool.state === 'output-error') return { id, name, state: 'error', errorText: tool.errorText ?? 'Mislukt' };
  if (tool.state === 'output-denied') return { id, name, state: 'error', errorText: 'Geweigerd' };
  return { id, name, state: 'running' };
}

export function toolCalls(message: UIMessage): ChatToolCall[] {
  return message.parts.map(toolCallOf).filter((call): call is ChatToolCall => call !== null);
}

export function isPointResult(value: unknown): value is PointResult {
  if (!isObj(value)) return false;
  const { latLng, area } = value;
  return typeof value.rdText === 'string' && isObj(latLng) && typeof latLng.lat === 'number' && typeof latLng.lng === 'number' && isObj(area);
}

export function isHintAnswerProposal(value: unknown): value is HintAnswerProposal {
  if (!isObj(value)) return false;
  const { point } = value;
  return (
    typeof value.articleId === 'number' &&
    typeof value.area === 'string' &&
    typeof value.answer === 'string' &&
    (value.kind === 'rd' || value.kind === 'text') &&
    (point === null || point === undefined || isPointResult(point))
  );
}

export function isWebSearchResult(value: unknown): value is WebSearchResult {
  return isObj(value) && typeof value.answer === 'string' && Array.isArray(value.sources);
}

/** "420 m", "1,2 km", "15 km" */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  const km = metres / 1000;
  return km < 10 ? `${km.toFixed(1).replace('.', ',')} km` : `${Math.round(km)} km`;
}

/** "bravo" → "Bravo" */
export function areaLabel(area: string): string {
  return areaOptions.find((option) => option.value === area.toLowerCase())?.label ?? area.charAt(0).toUpperCase() + area.slice(1);
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** A list output, or the list under `key` of an object output */
function listOf(output: unknown, key: string): unknown[] | null {
  if (Array.isArray(output)) return output;
  if (!isObj(output)) return null;
  const value = output[key];
  return Array.isArray(value) ? value : null;
}

/** The short result line of a finished tool in ToolsUsed (contract), the error text of a failed one, else null */
export function toolSummary(call: ChatToolCall): string | null {
  if (call.state === 'error') return call.errorText ?? 'Mislukt';
  if (call.state !== 'done') return null;
  const output = call.output;
  if (call.name === 'checkPoint') {
    if (!isObj(output)) return null;
    const point = output.point;
    if (!isPointResult(point)) return null;
    const area = point.area.area ? areaLabel(point.area.area) : 'onbekend gebied';
    const nearest = Array.isArray(output.nearestGroups) ? output.nearestGroups[0] : undefined;
    return isObj(nearest) && typeof nearest.name === 'string' && typeof nearest.distanceM === 'number' ? `${area} · ${nearest.name} ${formatDistance(nearest.distanceM)}` : area;
  }
  if (call.name === 'nearbyGroups') {
    const list = listOf(output, 'groups');
    return list ? count(list.length, 'groep', 'groepen') : null;
  }
  if (call.name === 'searchIntel') {
    const list = listOf(output, 'results');
    return list ? count(list.length, 'item', 'items') : null;
  }
  if (call.name === 'webSearch') return isWebSearchResult(output) ? count(output.sources.length, 'bron', 'bronnen') : null;
  return null;
}

/** The tools whose icons stack on the "N tools gebruikt" pill: the first call of each tone, at most 3 */
export function stackedTools(calls: ChatToolCall[]): string[] {
  const tones = new Set<ToolTone>();
  const names: string[] = [];
  for (const call of calls) {
    const tone = toolTone(call.name);
    if (tones.has(tone)) continue;
    tones.add(tone);
    names.push(call.name);
    if (names.length === 3) break;
  }
  return names;
}

export const THINKING_LABEL = 'Even denken…';

/**
 * The M3 status line while the AI works: the running tool's label, "Even denken…" before the first token or between
 * steps (also while it reasons), null once answer text streams or when idle.
 */
export function chatStatusLabel(messages: UIMessage[], status: ChatStatus): string | null {
  if (status !== 'submitted' && status !== 'streaming') return null;
  const last = messages.at(-1);
  if (!last || last.role !== 'assistant') return THINKING_LABEL;
  const running = toolCalls(last).filter((call) => call.state === 'running').at(-1);
  if (running) return toolLabel(running.name);
  const tail = last.parts.filter((part) => part.type !== 'step-start').at(-1);
  if (tail?.type === 'text' && tail.text.trim()) return null;
  return THINKING_LABEL;
}

/** Id of the newest user message (the list scrolls down again when it changes) */
export function lastUserMessageId(messages: UIMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index--) if (messages[index].role === 'user') return messages[index].id;
  return null;
}

/** E2 chips: per open area of a hint (area order, max 3) + "Check antwoorden"; fixed questions for opdracht / nieuws */
export function suggestionChips(item: Pick<IntelItem, 'kind' | 'cells'>): string[] {
  if (item.kind === 'assignment') return ['Wat moeten we inleveren?', 'Ideeën?'];
  if (item.kind === 'news') return ['Wat betekent dit voor ons?'];
  const states = areaStates(item.cells);
  const open = areaOptions.filter((option) => states[option.value] === 'open').slice(0, 3);
  return [...open.map((option) => `Los ${option.label} op`), 'Check antwoorden'];
}

/** The chip in the chat header: what the AI sees */
export const CONTEXT_LABEL: Record<IntelKind, string> = { hint: 'ziet deze hint', assignment: 'ziet deze opdracht', news: 'ziet dit bericht' };

export const PLACEHOLDER: Record<IntelKind, string> = {
  hint: 'Vraag iets over deze hint…',
  assignment: 'Vraag iets over deze opdracht…',
  news: 'Vraag iets over dit bericht…',
};

export type ChatErrorKind = 'rate_limited' | 'ai_unavailable' | 'not_found' | 'other';

export const RATE_LIMIT_MESSAGE = 'Even rustig aan: te veel vragen, probeer het zo weer';

/**
 * What went wrong: from an axios error (history GET/DELETE), an AI SDK APICallError (`statusCode`, stream POST) or the
 * `Error(data.error)` that fetcherWithMethod throws for a 200 with an error body.
 */
export function chatErrorKind(error: unknown): ChatErrorKind {
  const status = isAxiosError(error) ? error.response?.status : isObj(error) && typeof error.statusCode === 'number' ? error.statusCode : undefined;
  if (status === 429) return 'rate_limited';
  if (status === 503) return 'ai_unavailable';
  if (status === 404) return 'not_found';
  if (error instanceof Error && error.message === 'ai_unavailable') return 'ai_unavailable';
  if (error instanceof Error && error.message === 'rate_limited') return 'rate_limited';
  return 'other';
}

/** POST body (contract): only the newest message (the server prepends the stored history) plus the modes */
export function chatRequestBody(messages: UIMessage[], modes: ChatModes): IntelChatRequest {
  const message = messages.at(-1);
  if (!message) throw new Error('Geen bericht om te versturen');
  return { message, web: modes.web, deep: modes.deep };
}

export const CHAT_IMAGE_MAX_SIDE = 1600;
export const CHAT_IMAGE_QUALITY = 0.85;
/** Originals above this are refused before resizing */
export const CHAT_IMAGE_MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;
/** The server refuses a decoded file part above this (contract) */
export const CHAT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/** Why a picked/pasted/dropped file can't be attached, or null */
export function chatImageProblem(file: { type: string; size: number }): string | null {
  if (!file.type.startsWith('image/')) return 'Alleen afbeeldingen kunnen mee';
  if (file.size > CHAT_IMAGE_MAX_ORIGINAL_BYTES) return 'Afbeelding is groter dan 10 MB';
  return null;
}

/** Decoded byte size of a base64 data URL */
export function dataUrlBytes(url: string): number {
  const base64 = url.slice(url.indexOf(',') + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** A PointCard of an assistant message: from showPoint (point) or proposeHintAnswer (proposal, point when RD) */
export interface ChatPointCard {
  id: string;
  point: PointResult | null;
  proposal?: HintAnswerProposal;
}

export function pointCards(message: UIMessage): ChatPointCard[] {
  const cards: ChatPointCard[] = [];
  for (const call of toolCalls(message)) {
    if (call.state !== 'done') continue;
    const output = call.output;
    if (call.name === 'showPoint' && isPointResult(output)) cards.push({ id: call.id, point: output });
    if (call.name === 'proposeHintAnswer' && isHintAnswerProposal(output)) cards.push({ id: call.id, point: output.point ?? null, proposal: output });
  }
  return cards;
}

export interface ChatSource {
  title: string;
  url: string;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/** The web sources of a message's finished webSearch calls: http(s) only, each url once, the hostname when untitled */
export function webSources(message: UIMessage): ChatSource[] {
  const byUrl = new Map<string, ChatSource>();
  for (const call of toolCalls(message)) {
    if (call.state !== 'done' || call.name !== 'webSearch' || !isWebSearchResult(call.output)) continue;
    for (const source of call.output.sources as unknown[]) {
      if (!isObj(source) || typeof source.url !== 'string' || !/^https?:\/\//i.test(source.url) || byUrl.has(source.url)) continue;
      const title = typeof source.title === 'string' && source.title.trim() ? source.title.trim() : hostOf(source.url);
      byUrl.set(source.url, { title, url: source.url });
    }
  }
  return [...byUrl.values()];
}

/** Two answers are the same, ignoring case and spacing */
export function sameAnswer(a: string, b: string): boolean {
  const normal = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  return normal(a) === normal(b);
}
