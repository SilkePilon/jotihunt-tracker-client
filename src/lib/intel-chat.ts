import { isAxiosError } from 'axios';
import type { ChatStatus, ReasoningUIPart, UIMessage } from 'ai';
import { ASSIGNMENT_STATUS_LABELS, areaStates } from '@/lib/intel-window';
import { areaOptions } from '@/lib/utils';
import type { IntelItem, IntelKind } from '@/types/Intel';
import type {
  AssignmentInfo,
  AssignmentProposal,
  ChatModes,
  DecodeResult,
  FindPlacesResult,
  HintAnswerProposal,
  IntelChatRequest,
  IntersectResult,
  IntelToolName,
  LookAtPointResult,
  OvCandidateKind,
  OvDeparturesResult,
  OvJourneyResult,
  OvPredictionResult,
  OvStopsResult,
  PointResult,
  ToolTone,
  WebSearchResult,
} from '@/types/IntelChat';

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
  decodeCipher: { label: 'Code kraken…', tone: 'think' },
  findPlaces: { label: 'Plekken zoeken…', tone: 'map' },
  intersect: { label: 'Snijpunt uitrekenen…', tone: 'map' },
  lookAtPoint: { label: 'Luchtfoto bekijken…', tone: 'map' },
  getAssignment: { label: 'Opdracht lezen…', tone: 'app' },
  proposeAssignmentUpdate: { label: 'Wijziging klaarzetten…', tone: 'app' },
  ovStopsNear: { label: 'Haltes zoeken…', tone: 'map' },
  ovDepartures: { label: 'Vertrektijden ophalen…', tone: 'map' },
  ovJourney: { label: 'Rit volgen…', tone: 'map' },
  predictOvMovement: { label: 'OV-route voorspellen…', tone: 'think' },
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

const isLatLng = (value: unknown) => isObj(value) && typeof value.lat === 'number' && typeof value.lng === 'number';
const isAssignmentStatus = (value: unknown): value is AssignmentInfo['status'] => typeof value === 'string' && Object.hasOwn(ASSIGNMENT_STATUS_LABELS, value);

export function isDecodeResult(value: unknown): value is DecodeResult {
  return isObj(value) && Array.isArray(value.results) && value.results.every((row) => isObj(row) && typeof row.method === 'string' && typeof row.output === 'string');
}

export function isFindPlacesResult(value: unknown): value is FindPlacesResult {
  return (
    isObj(value) &&
    Array.isArray(value.places) &&
    value.places.every((place) => isObj(place) && typeof place.kind === 'string' && isLatLng(place.latLng) && typeof place.distanceM === 'number')
  );
}

export function isIntersectResult(value: unknown): value is IntersectResult {
  return isObj(value) && Array.isArray(value.points) && value.points.every(isPointResult);
}

/** Only https PDOK imagery is ever rendered */
function isPdokUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'pdok.nl' || url.hostname.endsWith('.pdok.nl'));
  } catch {
    return false;
  }
}

export function isLookAtPointResult(value: unknown): value is LookAtPointResult {
  return isObj(value) && typeof value.description === 'string' && typeof value.imageUrl === 'string' && isPdokUrl(value.imageUrl) && isPointResult(value.point);
}

export function isAssignmentInfo(value: unknown): value is AssignmentInfo {
  return isObj(value) && typeof value.articleId === 'number' && typeof value.title === 'string' && isAssignmentStatus(value.status) && Array.isArray(value.notes);
}

/** A proposal changes something: a valid status, a note, or both */
export function isAssignmentProposal(value: unknown): value is AssignmentProposal {
  if (!isObj(value) || typeof value.articleId !== 'number' || typeof value.title !== 'string') return false;
  const { status, note } = value;
  if (status !== undefined && !isAssignmentStatus(status)) return false;
  if (note !== undefined && typeof note !== 'string') return false;
  return status !== undefined || (typeof note === 'string' && note.trim() !== '');
}

const isStr = (value: unknown): value is string => typeof value === 'string';

const isOvStop = (value: unknown) =>
  isObj(value) && isStr(value.id) && isStr(value.name) && isLatLng(value.latLng) && typeof value.distanceM === 'number' && Array.isArray(value.modes);

export function isOvStopsResult(value: unknown): value is OvStopsResult {
  return isObj(value) && Array.isArray(value.stops) && value.stops.every(isOvStop);
}

export function isOvDeparturesResult(value: unknown): value is OvDeparturesResult {
  return (
    isObj(value) &&
    isOvStop(value.stop) &&
    Array.isArray(value.departures) &&
    value.departures.every(
      (row) => isObj(row) && isStr(row.mode) && isStr(row.line) && isStr(row.destination) && isStr(row.expected) && typeof row.delayMin === 'number',
    )
  );
}

export function isOvJourneyResult(value: unknown): value is OvJourneyResult {
  if (!isObj(value) || !isStr(value.mode) || !isStr(value.line) || !isStr(value.destination) || !Array.isArray(value.stops)) return false;
  if (!value.stops.every((stop) => isObj(stop) && isStr(stop.name) && isStr(stop.status))) return false;
  const { current } = value;
  return current === null || (isObj(current) && isLatLng(current.latLng) && Array.isArray(current.between));
}

export function isOvPredictionResult(value: unknown): value is OvPredictionResult {
  return (
    isObj(value) &&
    Array.isArray(value.assumptions) &&
    value.assumptions.every(isStr) &&
    Array.isArray(value.candidates) &&
    value.candidates.every(
      (row) => isObj(row) && isPointResult(row.point) && isStr(row.via) && isStr(row.kind) && isStr(row.atTime) && typeof row.score === 'number',
    )
  );
}

/** Kind chip of a predicted OV candidate */
export const OV_KIND_LABEL: Record<OvCandidateKind, string> = {
  onboard: 'in de bus/trein',
  alighted: 'uitgestapt',
  terminus: 'eindhalte',
  waiting: 'wacht op halte',
};

/** "+3" for a departure running late (whole minutes), null when on time or early */
export function delayLabel(delayMin: number): string | null {
  const minutes = Math.round(delayMin);
  return minutes > 0 ? `+${minutes}` : null;
}

const REACHED = new Set(['PASSED', 'DEPARTED', 'ARRIVED']);

/**
 * Index of the stop the vehicle left last: the current position row sits right after it (-1: before the first stop).
 * Prefers the `between[0]` stop followed by `between[1]` (loop lines visit a stop twice), then any `between[0]`, then the
 * last passed/departed/arrived stop. Null without a current position.
 */
export function journeyAnchor(journey: OvJourneyResult): number | null {
  if (!journey.current) return null;
  const { stops } = journey;
  const [from, to] = journey.current.between;
  let named = -1;
  for (let index = stops.length - 1; index >= 0; index--) {
    if (stops[index].name !== from) continue;
    if (stops[index + 1]?.name === to) return index;
    if (named === -1) named = index;
  }
  if (named !== -1) return named;
  for (let index = stops.length - 1; index >= 0; index--) if (REACHED.has(stops[index].status)) return index;
  return -1;
}

/** Stops shown of a folded timeline [start, end): 3 up to the current position and 5 after it, or the first 8 without one */
export function journeyWindow(count: number, anchor: number | null): { start: number; end: number } {
  if (anchor === null) return { start: 0, end: Math.min(count, 8) };
  return { start: Math.max(0, anchor - 2), end: Math.min(count, anchor + 6) };
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

const SUMMARY_MAX = 60;
/** At most 60 characters, an ellipsis when cut */
const clip = (text: string) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= SUMMARY_MAX ? flat : `${flat.slice(0, SUMMARY_MAX - 1).trimEnd()}…`;
};

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
  if (call.name === 'decodeCipher') {
    const best = isDecodeResult(output) ? output.results[0] : undefined;
    return best ? clip(`${best.method}: ${best.output}`) : null;
  }
  if (call.name === 'findPlaces') return isFindPlacesResult(output) ? count(output.places.length, 'plek', 'plekken') : null;
  if (call.name === 'intersect') return isIntersectResult(output) ? count(output.points.length, 'snijpunt', 'snijpunten') : null;
  if (call.name === 'lookAtPoint') return isLookAtPointResult(output) && output.description.trim() ? clip(output.description) : null;
  if (call.name === 'getAssignment') return isAssignmentInfo(output) ? ASSIGNMENT_STATUS_LABELS[output.status] : null;
  if (call.name === 'ovStopsNear') return isOvStopsResult(output) ? count(output.stops.length, 'halte', 'haltes') : null;
  if (call.name === 'ovDepartures') return isOvDeparturesResult(output) ? clip(`${count(output.departures.length, 'vertrek', 'vertrekken')} · ${output.stop.name}`) : null;
  if (call.name === 'ovJourney') return isOvJourneyResult(output) ? clip(`${output.line} → ${output.destination}`) : null;
  if (call.name === 'predictOvMovement') return isOvPredictionResult(output) ? count(output.candidates.length, 'kandidaat', 'kandidaten') : null;
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

const isReasoning = (part: ChatPart): part is ReasoningUIPart => part.type === 'reasoning';
/** Text or reasoning without content, and step starts, say nothing about where the turn is */
const isMeaningful = (part: ChatPart) => part.type !== 'step-start' && !((part.type === 'text' || part.type === 'reasoning') && !part.text.trim());

/** The model's thinking of a turn as one text: every non-empty reasoning part (all steps), a blank line between them */
export function reasoningText(message: UIMessage): string {
  return message.parts
    .filter(isReasoning)
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join('\n\n');
}

/**
 * The model is thinking right now: the newest meaningful part is reasoning that has not finished. Answer text or a tool
 * call after it ends the thinking even when the part never got `state: 'done'`. Only meaningful for the streaming message.
 */
export function reasoningActive(message: UIMessage): boolean {
  const tail = message.parts.filter(isMeaningful).at(-1);
  return tail !== undefined && isReasoning(tail) && tail.state !== 'done';
}

/**
 * The thinking phase of the streaming turn: from the first non-empty thought until the answer starts, i.e. non-empty text
 * after the last thought or tool call (text between steps is not the answer), or until the stream stops (finished,
 * aborted, error). Tool calls and later thoughts keep it going, so the "Nadenken" section stays open across steps.
 */
export function thinkingPhase(message: UIMessage, streaming: boolean): boolean {
  if (!streaming) return false;
  const { parts } = message;
  const isThought = (part: ChatPart) => isReasoning(part) && part.text.trim() !== '';
  if (!parts.some(isThought)) return false;
  for (let index = parts.length - 1; index >= 0; index--) {
    const part = parts[index];
    if (isThought(part) || toolCallOf(part) !== null) return true;
    if (part.type === 'text' && part.text.trim() !== '') return false;
  }
  return false;
}

/**
 * The M3 status line while the AI works: the running tool's label, "Even denken…" before the first token or between
 * steps, null while a reasoning section streams (it has its own "Nadenken…" header), once answer text streams or when idle.
 */
export function chatStatusLabel(messages: UIMessage[], status: ChatStatus): string | null {
  if (status !== 'submitted' && status !== 'streaming') return null;
  const last = messages.at(-1);
  if (!last || last.role !== 'assistant') return THINKING_LABEL;
  const running = toolCalls(last).filter((call) => call.state === 'running').at(-1);
  if (running) return toolLabel(running.name);
  if (reasoningActive(last)) return null;
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

export type ChatErrorKind = 'rate_limited' | 'ai_unavailable' | 'not_found' | 'busy' | 'other';

export const BUSY_MESSAGE = 'Vorige vraag wordt nog afgerond, probeer het zo opnieuw';

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
  if (status === 409) return 'busy';
  if (error instanceof Error && error.message === 'ai_unavailable') return 'ai_unavailable';
  if (error instanceof Error && error.message === 'rate_limited') return 'rate_limited';
  return 'other';
}

export const BUSY_RETRY_DELAYS_MS = [400, 800, 1600];

const abortError = () => new DOMException('Aborted', 'AbortError');

/** Resolves after ms; rejects with an AbortError as soon as the signal aborts */
export function abortableSleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * The server answers 409 while the previous turn of this chat is still being saved (e.g. stop, then ask again at once):
 * transparently retry that after 400, 800 and 1600 ms. Other statuses pass through; an abort stops the waiting.
 */
export async function fetchRetryingBusy(
  doFetch: typeof fetch,
  input: RequestInfo | URL,
  init?: RequestInit,
  sleep: (ms: number, signal?: AbortSignal | null) => Promise<void> = abortableSleep,
): Promise<Response> {
  let response = await doFetch(input, init);
  for (const delay of BUSY_RETRY_DELAYS_MS) {
    if (response.status !== 409) break;
    await sleep(delay, init?.signal);
    response = await doFetch(input, init);
  }
  return response;
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

/** A card under an assistant message, in call order */
export type ChatCard =
  /** showPoint, each intersect point (show only), or proposeHintAnswer (proposal, point when RD) */
  | { type: 'point'; id: string; point: PointResult | null; proposal?: HintAnswerProposal }
  /** lookAtPoint: aerial photo + description */
  | { type: 'look'; id: string; look: LookAtPointResult }
  /** proposeAssignmentUpdate: "Opslaan" */
  | { type: 'assignment'; id: string; proposal: AssignmentProposal }
  /** ovDepartures: departure board of a stop */
  | { type: 'departures'; id: string; departures: OvDeparturesResult }
  /** ovJourney: stop timeline with the current position */
  | { type: 'journey'; id: string; journey: OvJourneyResult }
  /** predictOvMovement: ranked candidates */
  | { type: 'ovPrediction'; id: string; prediction: OvPredictionResult };

export function chatCards(message: UIMessage): ChatCard[] {
  const cards: ChatCard[] = [];
  for (const call of toolCalls(message)) {
    if (call.state !== 'done') continue;
    const output = call.output;
    if (call.name === 'showPoint' && isPointResult(output)) cards.push({ type: 'point', id: call.id, point: output });
    if (call.name === 'intersect' && isIntersectResult(output)) output.points.forEach((point, index) => cards.push({ type: 'point', id: `${call.id}-${index}`, point }));
    if (call.name === 'proposeHintAnswer' && isHintAnswerProposal(output)) cards.push({ type: 'point', id: call.id, point: output.point ?? null, proposal: output });
    if (call.name === 'lookAtPoint' && isLookAtPointResult(output)) cards.push({ type: 'look', id: call.id, look: output });
    if (call.name === 'proposeAssignmentUpdate' && isAssignmentProposal(output)) cards.push({ type: 'assignment', id: call.id, proposal: output });
    if (call.name === 'ovDepartures' && isOvDeparturesResult(output)) cards.push({ type: 'departures', id: call.id, departures: output });
    if (call.name === 'ovJourney' && isOvJourneyResult(output)) cards.push({ type: 'journey', id: call.id, journey: output });
    if (call.name === 'predictOvMovement' && isOvPredictionResult(output)) cards.push({ type: 'ovPrediction', id: call.id, prediction: output });
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
