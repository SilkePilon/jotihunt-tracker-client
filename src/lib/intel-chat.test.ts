import { describe, expect, test } from 'bun:test';
import { AxiosError, AxiosHeaders } from 'axios';
import type { UIMessage } from 'ai';
import type { HintCell } from '@/types/HintCell';
import { scaledSize } from './image';
import {
  CHAT_IMAGE_MAX_SIDE,
  CONTEXT_LABEL,
  THINKING_LABEL,
  TOOL_META,
  chatErrorKind,
  fetchRetryingBusy,
  chatImageProblem,
  chatRequestBody,
  chatStatusLabel,
  dataUrlBytes,
  formatDistance,
  isHintAnswerProposal,
  isPointResult,
  lastUserMessageId,
  reasoningActive,
  reasoningText,
  sameAnswer,
  stackedTools,
  suggestionChips,
  thinkingPhase,
  toolCalls,
  toolDoneLabel,
  toolLabel,
  toolSummary,
  chatCards,
  isAssignmentInfo,
  isAssignmentProposal,
  isDecodeResult,
  isFindPlacesResult,
  isIntersectResult,
  isLookAtPointResult,
  toolTone,
  webSources,
} from './intel-chat';

const point = {
  label: 'Bravo',
  latLng: { lat: 51.83, lng: 5.86 },
  rd: { x: 153020, y: 430880 },
  rdText: '153020 430880',
  area: { area: 'bravo', method: 'hull' },
  nearestGroup: { name: 'Scouting Pancratius', area: 'bravo', distanceM: 420 },
};
const tool = (name: string, state: string, extra: Record<string, unknown> = {}, id = name) => ({ type: `tool-${name}`, toolCallId: id, state, input: {}, ...extra });
const assistant = (...parts: unknown[]) => ({ id: 'a1', role: 'assistant', parts }) as UIMessage;
const user = (id: string, text = 'Los Bravo op') => ({ id, role: 'user', parts: [{ type: 'text', text }] }) as UIMessage;
const cell = (area: string, status: HintCell['status']): HintCell => ({ _id: area, articleId: 1, area, publishAt: '', slotTime: '', status, articleChanged: false }) as HintCell;

describe('tool meta', () => {
  test('every contract tool has a running label and a tone', () => {
    expect(Object.keys(TOOL_META)).toHaveLength(24);
    expect(toolLabel('decodeCipher')).toBe('Code kraken…');
    expect(toolTone('decodeCipher')).toBe('think');
    expect(toolLabel('findPlaces')).toBe('Plekken zoeken…');
    expect(toolLabel('intersect')).toBe('Snijpunt uitrekenen…');
    expect(toolLabel('lookAtPoint')).toBe('Luchtfoto bekijken…');
    expect(toolTone('lookAtPoint')).toBe('map');
    expect(toolLabel('getAssignment')).toBe('Opdracht lezen…');
    expect(toolLabel('proposeAssignmentUpdate')).toBe('Wijziging klaarzetten…');
    expect(toolTone('proposeAssignmentUpdate')).toBe('app');
    expect(toolLabel('webSearch')).toBe('Zoeken op internet…');
    expect(toolLabel('getItem')).toBe('Item lezen…');
    expect(toolLabel('somethingNew')).toBe('Bezig…');
    expect(toolDoneLabel('checkPoint')).toBe('Punt checken');
    expect(toolDoneLabel('somethingNew')).toBe('somethingNew');
    expect(toolTone('runCode')).toBe('think');
    expect(toolTone('readWebPage')).toBe('web');
    expect(toolTone('showPoint')).toBe('map');
    expect(toolTone('somethingNew')).toBe('app');
  });
});

describe('toolCalls', () => {
  test('flattens tool parts in order and skips the rest', () => {
    const message = assistant(
      { type: 'step-start' },
      tool('getItem', 'output-available', { output: { title: 'x' } }),
      { type: 'text', text: 'Even kijken' },
      tool('webSearch', 'input-streaming'),
      tool('checkPoint', 'output-error', { errorText: 'kapot' }),
      tool('nearbyGroups', 'output-available', { output: { error: 'Geen groepen' } }),
      { type: 'dynamic-tool', toolName: 'distance', toolCallId: 'd', state: 'input-available', input: {} },
    );
    expect(toolCalls(message)).toEqual([
      { id: 'getItem', name: 'getItem', state: 'done', output: { title: 'x' } },
      { id: 'webSearch', name: 'webSearch', state: 'running' },
      { id: 'checkPoint', name: 'checkPoint', state: 'error', errorText: 'kapot' },
      { id: 'nearbyGroups', name: 'nearbyGroups', state: 'error', output: { error: 'Geen groepen' }, errorText: 'Geen groepen' },
      { id: 'd', name: 'distance', state: 'running' },
    ]);
  });
});

describe('output guards', () => {
  test('point results and proposals', () => {
    expect(isPointResult(point)).toBe(true);
    expect(isPointResult({ ...point, latLng: null })).toBe(false);
    expect(isPointResult({ error: 'x' })).toBe(false);
    expect(isHintAnswerProposal({ articleId: 1, area: 'bravo', answer: '153020 430880', kind: 'rd', point })).toBe(true);
    expect(isHintAnswerProposal({ articleId: 1, area: 'bravo', answer: 'Kerk', kind: 'text', point: null })).toBe(true);
    expect(isHintAnswerProposal({ articleId: '1', area: 'bravo', answer: 'x', kind: 'text', point: null })).toBe(false);
  });

  test('extra tools', () => {
    expect(isDecodeResult({ results: [{ method: 'caesar', detail: 'shift 3', output: 'HALLO' }] })).toBe(true);
    expect(isDecodeResult({ results: [{ method: 'caesar' }] })).toBe(false);
    expect(isDecodeResult({ error: 'x' })).toBe(false);
    expect(isFindPlacesResult({ places: [{ name: null, kind: 'church', latLng: { lat: 52, lng: 5 }, rdText: '1 2', distanceM: 300 }] })).toBe(true);
    expect(isFindPlacesResult({ places: 'nee' })).toBe(false);
    expect(isIntersectResult({ points: [point], note: 'twee cirkels' })).toBe(true);
    expect(isIntersectResult({ points: [] })).toBe(true);
    expect(isIntersectResult({ points: [{ label: 'x' }] })).toBe(false);
    expect(isLookAtPointResult({ description: 'Een kerk', imageUrl: 'https://service.pdok.nl/x', point })).toBe(true);
    expect(isLookAtPointResult({ description: 'Een kerk', imageUrl: 'https://service.pdok.nl/x', point: null })).toBe(false);
    for (const imageUrl of ['http://service.pdok.nl/x', 'https://evil.example/x', 'https://notpdok.nl/x', 'javascript:alert(1)', 'not a url']) {
      expect(isLookAtPointResult({ description: 'Een kerk', imageUrl, point })).toBe(false);
    }
    expect(isLookAtPointResult({ description: 'Een kerk', imageUrl: 'https://pdok.nl/x', point })).toBe(true);
    const info = { articleId: 9, title: 'Opdracht 3', status: 'busy', owner: null, notes: [], endTime: null, maxPoints: 100 };
    expect(isAssignmentInfo(info)).toBe(true);
    expect(isAssignmentInfo({ ...info, status: 'klaar' })).toBe(false);
    expect(isAssignmentProposal({ articleId: 9, title: 'Opdracht 3', status: 'submitted' })).toBe(true);
    expect(isAssignmentProposal({ articleId: 9, title: 'Opdracht 3', note: 'Filmpje staat in de drive' })).toBe(true);
    expect(isAssignmentProposal({ articleId: 9, title: 'Opdracht 3' })).toBe(false);
    expect(isAssignmentProposal({ articleId: 9, title: 'Opdracht 3', status: 'klaar' })).toBe(false);
  });
});

describe('formatDistance', () => {
  test('metres below a km, one decimal below 10 km, whole km above', () => {
    expect(formatDistance(420)).toBe('420 m');
    expect(formatDistance(1234)).toBe('1,2 km');
    expect(formatDistance(15400)).toBe('15 km');
  });
});

describe('toolSummary', () => {
  test('per the contract', () => {
    const done = (name: string, output: unknown) => ({ id: name, name, state: 'done' as const, output });
    expect(toolSummary(done('checkPoint', { point, nearestGroups: [{ name: 'Scouting Pancratius', area: 'bravo', distanceM: 420 }] }))).toBe('Bravo · Scouting Pancratius 420 m');
    expect(toolSummary(done('checkPoint', { point: { ...point, area: { area: null, method: 'none' } }, nearestGroups: [] }))).toBe('onbekend gebied');
    expect(toolSummary(done('nearbyGroups', [{}, {}, {}]))).toBe('3 groepen');
    expect(toolSummary(done('nearbyGroups', { groups: [{}] }))).toBe('1 groep');
    expect(toolSummary(done('webSearch', { answer: 'x', sources: [{ title: 'a', url: 'https://a.nl' }, { title: 'b', url: 'https://b.nl' }] }))).toBe('2 bronnen');
    expect(toolSummary(done('searchIntel', { results: [{}, {}, {}, {}] }))).toBe('4 items');
    expect(toolSummary(done('getItem', { title: 'x' }))).toBeNull();
    expect(toolSummary({ id: 'x', name: 'checkPoint', state: 'error', errorText: 'Punt ligt buiten NL' })).toBe('Punt ligt buiten NL');
    expect(toolSummary({ id: 'x', name: 'checkPoint', state: 'running' })).toBeNull();
  });

  test('extra tools', () => {
    const done = (name: string, output: unknown) => ({ id: name, name, state: 'done' as const, output });
    expect(toolSummary(done('decodeCipher', { results: [{ method: 'caesar', detail: 'shift 3', output: 'KERK BIJ DE MOLEN' }, { method: 'atbash', output: 'x' }] }))).toBe('caesar: KERK BIJ DE MOLEN');
    expect(toolSummary(done('decodeCipher', { results: [{ method: 'morse', output: 'A'.repeat(80) }] }))).toBe(`morse: ${'A'.repeat(52)}…`);
    expect(toolSummary(done('decodeCipher', { results: [] }))).toBeNull();
    const place = { name: 'Sint-Jan', kind: 'church', latLng: { lat: 52, lng: 5 }, rdText: '1 2', distanceM: 300 };
    expect(toolSummary(done('findPlaces', { places: [place, place, place] }))).toBe('3 plekken');
    expect(toolSummary(done('findPlaces', { places: [place] }))).toBe('1 plek');
    expect(toolSummary(done('intersect', { points: [point, point] }))).toBe('2 snijpunten');
    expect(toolSummary(done('intersect', { points: [point] }))).toBe('1 snijpunt');
    expect(toolSummary(done('lookAtPoint', { description: 'Een kerk met een groot plein ervoor en een molen aan de rand van het dorp.', imageUrl: 'https://service.pdok.nl/x', point }))).toBe(
      'Een kerk met een groot plein ervoor en een molen aan de ran…',
    );
    expect(toolSummary(done('lookAtPoint', { description: 'Weiland', imageUrl: 'https://service.pdok.nl/x', point }))).toBe('Weiland');
    expect(toolSummary(done('getAssignment', { articleId: 9, title: 'x', status: 'submitted', owner: null, notes: [], endTime: null, maxPoints: null }))).toBe('Ingeleverd');
    expect(toolSummary(done('proposeAssignmentUpdate', { articleId: 9, title: 'x', status: 'busy' }))).toBeNull();
  });

  test('stackedTools: first tool of each tone, at most 3', () => {
    const call = (name: string) => ({ id: name, name, state: 'done' as const });
    expect(stackedTools([call('getItem'), call('getAreas'), call('webSearch'), call('checkPoint'), call('runCode')])).toEqual(['getItem', 'webSearch', 'checkPoint']);
  });
});

describe('chatStatusLabel', () => {
  test('null when idle or while text streams; the running tool; else thinking', () => {
    expect(chatStatusLabel([user('u1')], 'ready')).toBeNull();
    expect(chatStatusLabel([user('u1')], 'submitted')).toBe(THINKING_LABEL);
    expect(chatStatusLabel([user('u1'), assistant(tool('getItem', 'output-available', { output: {} }), tool('checkPoint', 'input-available'))], 'streaming')).toBe('Punt checken…');
    expect(chatStatusLabel([user('u1'), assistant(tool('getItem', 'output-available', { output: {} }), { type: 'step-start' })], 'streaming')).toBe(THINKING_LABEL);
    // A streaming reasoning section shows its own "Nadenken…" header; done or still empty: the line says thinking
    expect(chatStatusLabel([user('u1'), assistant({ type: 'reasoning', text: 'hmm', state: 'streaming' })], 'streaming')).toBeNull();
    expect(chatStatusLabel([user('u1'), assistant({ type: 'reasoning', text: 'hmm', state: 'done' })], 'streaming')).toBe(THINKING_LABEL);
    expect(chatStatusLabel([user('u1'), assistant({ type: 'reasoning', text: '', state: 'streaming' })], 'streaming')).toBe(THINKING_LABEL);
    expect(chatStatusLabel([user('u1'), assistant({ type: 'text', text: 'Bravo wijst' })], 'streaming')).toBeNull();
    expect(chatStatusLabel([user('u1'), assistant({ type: 'text', text: 'x' })], 'error')).toBeNull();
  });

  test('lastUserMessageId', () => {
    expect(lastUserMessageId([])).toBeNull();
    expect(lastUserMessageId([user('u1'), assistant(), user('u2'), assistant()])).toBe('u2');
  });
});

describe('reasoning', () => {
  const think = (text: string, state: 'streaming' | 'done' = 'done') => ({ type: 'reasoning', text, state });
  const text = (value: string) => ({ type: 'text', text: value });

  test('reasoningText: all non-empty reasoning parts of the turn, blank line between steps', () => {
    expect(reasoningText(assistant(text('Bravo')))).toBe('');
    expect(reasoningText(assistant(think('  '), text('Bravo')))).toBe('');
    expect(reasoningText(assistant({ type: 'step-start' }, think('Eerst de hint lezen.\n'), tool('getItem', 'output-available', { output: {} }), { type: 'step-start' }, think(''), think('Nu rekenen.'), text('Bravo')))).toBe(
      'Eerst de hint lezen.\n\nNu rekenen.',
    );
  });

  test('reasoningActive: the newest meaningful part is reasoning that still streams', () => {
    expect(reasoningActive(assistant())).toBe(false);
    expect(reasoningActive(assistant(think('hmm', 'streaming')))).toBe(true);
    expect(reasoningActive(assistant(think('hmm', 'streaming'), { type: 'step-start' }, think('', 'streaming')))).toBe(true);
    expect(reasoningActive(assistant(think('', 'streaming')))).toBe(false);
    expect(reasoningActive(assistant(think('hmm', 'done')))).toBe(false);
    // Answer text or a tool after it: thinking is over, even if the part never got 'done'
    expect(reasoningActive(assistant(think('hmm', 'streaming'), text('Bravo')))).toBe(false);
    expect(reasoningActive(assistant(think('hmm', 'streaming'), tool('checkPoint', 'input-available')))).toBe(false);
    // Thinking again in a later step
    expect(reasoningActive(assistant(think('a'), tool('getItem', 'output-available', { output: {} }), { type: 'step-start' }, think('b', 'streaming')))).toBe(true);
  });

  test('thinkingPhase: open from the first thought until the answer text streams, across tool steps', () => {
    const done = tool('getItem', 'output-available', { output: {} });
    const steps = [think('a'), tool('getItem', 'input-available'), { type: 'step-start' }, think('b'), tool('checkPoint', 'output-available', { output: {} }, 'c'), { type: 'step-start' }];
    // reasoning → tool → reasoning → tool: open the whole time, also while a tool runs or between steps
    for (let end = 1; end <= steps.length; end++) expect(thinkingPhase(assistant(...steps.slice(0, end)), true)).toBe(true);
    // ... until the answer text after the last thought / tool starts streaming
    expect(thinkingPhase(assistant(...steps, text('')), true)).toBe(true);
    expect(thinkingPhase(assistant(...steps, text('Bravo')), true)).toBe(false);
    // Text between steps (before a later tool or thought) is not the answer
    expect(thinkingPhase(assistant(think('a'), text('Even kijken'), done), true)).toBe(true);
    expect(thinkingPhase(assistant(think('a'), text('Even kijken'), done, think('b', 'streaming')), true)).toBe(true);
  });
  test('thinkingPhase: reasoning only, then the stream ends (finished, aborted or error)', () => {
    expect(thinkingPhase(assistant(think('hmm', 'streaming')), true)).toBe(true);
    expect(thinkingPhase(assistant(think('hmm', 'done')), true)).toBe(true);
    expect(thinkingPhase(assistant(think('hmm', 'streaming')), false)).toBe(false);
    expect(thinkingPhase(assistant(think('a'), tool('getItem', 'input-available')), false)).toBe(false);
  });
  test('thinkingPhase: no (non-empty) thought yet means no thinking phase', () => {
    expect(thinkingPhase(assistant(), true)).toBe(false);
    expect(thinkingPhase(assistant(think('  ', 'streaming')), true)).toBe(false);
    expect(thinkingPhase(assistant(think(''), tool('getItem', 'input-available')), true)).toBe(false);
    expect(thinkingPhase(assistant(tool('getItem', 'input-available'), think('', 'streaming')), true)).toBe(false);
    expect(thinkingPhase(assistant(think('a'), text('Bravo'), think('', 'streaming')), true)).toBe(false);
  });
});

describe('suggestionChips and copy', () => {
  test('hint: open areas in area order (max 3) + check', () => {
    const cells = [cell('alpha', 'solved'), cell('bravo', 'open'), cell('charlie', 'open'), cell('delta', 'none'), cell('echo', 'open'), cell('golf', 'open')];
    expect(suggestionChips({ kind: 'hint', cells })).toEqual(['Los Bravo op', 'Los Charlie op', 'Los Echo op', 'Check antwoorden']);
    expect(suggestionChips({ kind: 'hint', cells: [cell('alpha', 'solved')] })).toEqual(['Check antwoorden']);
  });
  test('opdracht and nieuws', () => {
    expect(suggestionChips({ kind: 'assignment', cells: [] })).toEqual(['Wat moeten we inleveren?', 'Ideeën?']);
    expect(suggestionChips({ kind: 'news', cells: [] })).toEqual(['Wat betekent dit voor ons?']);
  });
  test('context chip', () => {
    expect(CONTEXT_LABEL).toEqual({ hint: 'ziet deze hint', assignment: 'ziet deze opdracht', news: 'ziet dit bericht' });
  });
});

describe('chatErrorKind', () => {
  const axiosError = (status: number) => new AxiosError('x', String(status), undefined, undefined, { status, data: {}, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } });
  test('axios (history GET) and APICallError-like (stream POST) status codes', () => {
    expect(chatErrorKind(axiosError(503))).toBe('ai_unavailable');
    expect(chatErrorKind(axiosError(404))).toBe('not_found');
    expect(chatErrorKind(Object.assign(new Error('{"error":"rate_limited"}'), { statusCode: 429 }))).toBe('rate_limited');
    expect(chatErrorKind(Object.assign(new Error('x'), { statusCode: 503 }))).toBe('ai_unavailable');
    expect(chatErrorKind(Object.assign(new Error('x'), { statusCode: 409 }))).toBe('busy');
  });
  test('a 200 with { error } (fetcherWithMethod throws Error(error)) and anything else', () => {
    expect(chatErrorKind(new Error('ai_unavailable'))).toBe('ai_unavailable');
    expect(chatErrorKind(new Error('Failed to fetch'))).toBe('other');
    expect(chatErrorKind(undefined)).toBe('other');
  });
});

describe('chatRequestBody', () => {
  test('only the newest message plus the modes', () => {
    expect(chatRequestBody([user('u1'), assistant(), user('u2', 'En Charlie?')], { web: true, deep: false })).toEqual({ message: user('u2', 'En Charlie?'), web: true, deep: false });
    expect(() => chatRequestBody([], { web: false, deep: false })).toThrow();
  });
});

describe('chat images', () => {
  test('only images up to 10 MB', () => {
    expect(chatImageProblem({ type: 'image/png', size: 5 * 1024 * 1024 })).toBeNull();
    expect(chatImageProblem({ type: 'application/pdf', size: 1000 })).toBe('Alleen afbeeldingen kunnen mee');
    expect(chatImageProblem({ type: 'image/jpeg', size: 11 * 1024 * 1024 })).toBe('Afbeelding is groter dan 10 MB');
  });
  test('decoded size of a base64 data URL', () => {
    expect(dataUrlBytes('data:image/jpeg;base64,YWJjZA==')).toBe(4);
    expect(dataUrlBytes('data:image/jpeg;base64,YWJj')).toBe(3);
    expect(dataUrlBytes('data:image/jpeg;base64,YWI=')).toBe(2);
  });
  test('resize target: long side 1600, never upscaled', () => {
    expect(scaledSize(4000, 3000, CHAT_IMAGE_MAX_SIDE)).toEqual({ width: 1600, height: 1200 });
    expect(scaledSize(3000, 4000, CHAT_IMAGE_MAX_SIDE)).toEqual({ width: 1200, height: 1600 });
    expect(scaledSize(1200, 900, CHAT_IMAGE_MAX_SIDE)).toEqual({ width: 1200, height: 900 });
  });
});

describe('cards and sources of a message', () => {
  test('chatCards: points, intersections, aerial looks and assignment proposals in call order', () => {
    const proposal = { articleId: 7, area: 'bravo', answer: '153020 430880', kind: 'rd', point };
    const look = { description: 'Een kerk', imageUrl: 'https://service.pdok.nl/x', point };
    const update = { articleId: 9, title: 'Opdracht 3', status: 'submitted' };
    const other = { ...point, label: 'Tweede' };
    const message = assistant(
      tool('intersect', 'output-available', { output: { points: [point, other] } }, 'i1'),
      tool('showPoint', 'output-available', { output: point }, 's1'),
      tool('lookAtPoint', 'output-available', { output: look }, 'l1'),
      tool('lookAtPoint', 'output-available', { output: { error: 'Geen luchtfoto' } }, 'l2'),
      tool('proposeAssignmentUpdate', 'output-available', { output: update }, 'a1'),
      tool('proposeAssignmentUpdate', 'input-available', {}, 'a2'),
      tool('proposeHintAnswer', 'output-available', { output: proposal }, 'p1'),
    );
    expect(chatCards(message)).toEqual([
      { type: 'point', id: 'i1-0', point },
      { type: 'point', id: 'i1-1', point: other },
      { type: 'point', id: 's1', point },
      { type: 'look', id: 'l1', look },
      { type: 'assignment', id: 'a1', proposal: update },
      { type: 'point', id: 'p1', point, proposal },
    ]);
  });
  test('webSources: deduped by url, http(s) only, hostname when no title', () => {
    const message = assistant(
      tool('webSearch', 'output-available', { output: { answer: 'x', sources: [{ title: 'MacLeod tartan · Wikipedia', url: 'https://en.wikipedia.org/wiki/MacLeod' }, { title: '', url: 'https://www.clan-macleod.org/x' }] } }, 'w1'),
      tool('webSearch', 'output-available', { output: { answer: 'y', sources: [{ title: 'dubbel', url: 'https://en.wikipedia.org/wiki/MacLeod' }, { title: 'kwaad', url: 'javascript:alert(1)' }] } }, 'w2'),
    );
    expect(webSources(message)).toEqual([
      { title: 'MacLeod tartan · Wikipedia', url: 'https://en.wikipedia.org/wiki/MacLeod' },
      { title: 'clan-macleod.org', url: 'https://www.clan-macleod.org/x' },
    ]);
  });
  test('sameAnswer ignores case and spacing', () => {
    expect(sameAnswer(' 153020  430880 ', '153020 430880')).toBe(true);
    expect(sameAnswer('Kerk', 'kerk')).toBe(true);
    expect(sameAnswer('153020 430880', '153020 430881')).toBe(false);
  });
});

describe('fetchRetryingBusy', () => {
  const make = (statuses: number[]) => {
    let n = 0;
    const doFetch = (async () => new Response(null, { status: statuses[Math.min(n++, statuses.length - 1)] })) as typeof fetch;
    return { count: () => n, doFetch };
  };
  test('retries a 409 with 400/800/1600 ms backoff until it succeeds', async () => {
    const { count, doFetch } = make([409, 409, 200]);
    const delays: number[] = [];
    const response = await fetchRetryingBusy(doFetch, '/x', {}, async (ms) => void delays.push(ms));
    expect(response.status).toBe(200);
    expect(count()).toBe(3);
    expect(delays).toEqual([400, 800]);
  });
  test('gives the 409 back after 3 retries', async () => {
    const { count, doFetch } = make([409]);
    const delays: number[] = [];
    const response = await fetchRetryingBusy(doFetch, '/x', {}, async (ms) => void delays.push(ms));
    expect(response.status).toBe(409);
    expect(count()).toBe(4);
    expect(delays).toEqual([400, 800, 1600]);
  });
  test('other statuses are not retried', async () => {
    const { count, doFetch } = make([500]);
    expect((await fetchRetryingBusy(doFetch, '/x', {}, async () => {})).status).toBe(500);
    expect(count()).toBe(1);
  });
  test('an abort while waiting stops the retrying', async () => {
    const { count, doFetch } = make([409]);
    const controller = new AbortController();
    const sleep = async () => {
      controller.abort();
      throw new DOMException('Aborted', 'AbortError');
    };
    await expect(fetchRetryingBusy(doFetch, '/x', { signal: controller.signal }, sleep)).rejects.toThrow();
    expect(count()).toBe(1);
  });
});
