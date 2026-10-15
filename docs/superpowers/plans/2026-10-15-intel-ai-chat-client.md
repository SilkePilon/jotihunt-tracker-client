# Intel AI chat — client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An open item in the Intel window (hint, opdracht, nieuws) gets an AI chat card on its right: ask the AI to solve a hint or explain an opdracht, see which tools it uses, get point cards with a mini map and save a proposed answer with one click.

**Architecture:** `DetailView` in `IntelDialog.tsx` becomes two columns (item left `flex-[1.25]`, chat card right `flex-1`). New folder `src/components/intel-window/chat/` holds the card, a `useIntelChat` hook (AI SDK `useChat` + `DefaultChatTransport` posting `{ message, web, deep }` with the Bearer token, history from `GET /intel-chat/:id` via `useAuthSWR`), a T1 prompt box (restyled PromptInput compound), message rendering (markdown, ToolStatus, ToolsUsed, PointCard, SourceChips) and the E2 empty state. Pure logic (tool labels/tones/summaries, status line, suggestion chips, error kinds, request body, image checks, output guards) lives in `src/lib/intel-chat.ts` with Bun unit tests. Mode toggles persist per user in a small zustand `persist` store.

**Tech Stack:** React 19 + TypeScript + Vite, Tailwind v4, `ai` 7.0.141 + `@ai-sdk/react` 4.0.145 (pairs with the server's `ai` ^7.0.127: same major, UI message stream v1), `react-markdown` 10.1.0, SWR (`useAuthSWR`, `fetcherWithMethod`), zustand, `motion/react` (MotionConfig `reducedMotion="user"` is global in `main.tsx`), `react-map-gl/maplibre`, sonner toasts, lucide-react, Bun test runner for `src/lib/*.test.ts`.

Spec: `docs/superpowers/specs/2026-10-15-intel-ai-chat-design.md`. **Binding contract** (the server is built in parallel against it): `docs/superpowers/specs/2026-10-15-intel-ai-chat-contract.md`. Mockups (visual + timing reference, open them in a browser): `.superpowers/brainstorm/1805043-1792055778/content/` — `layout.html` option **B**, `promptbox-v2.html` option **T1**, `messages.html` option **M3** (press "▶ Afspelen"), `empty-state.html` option **E2** (press "▶ Afspelen").

### AI SDK facts (verified against the installed `ai@7.0.141` / `@ai-sdk/react@4.0.145` `.d.ts` files)

- `useChat({ id, transport, onError, onFinish })` returns `{ messages, status, error, setMessages, sendMessage, regenerate, stop, clearError }`. `status: 'submitted' | 'streaming' | 'ready' | 'error'`. A new `Chat` is created when `id` changes; `useChat` calls `chat.stop()` on unmount (so switching items stops the stream). `setMessages` is stable per chat. The transport is read from the latest render on every send.
- `new DefaultChatTransport<UIMessage>({ api, prepareSendMessagesRequest })`; `prepareSendMessagesRequest({ messages, trigger, ... })` returns `{ body, headers }`.
- `sendMessage({ text, files?: FileUIPart[] })`; `FileUIPart = { type: 'file', mediaType, url, filename? }`. `regenerate()` drops the last assistant message and re-sends (body's last message is then the user message).
- A non-2xx answer rejects with an `APICallError` that carries `statusCode` and `responseBody` (e.g. `'{"error":"rate_limited"}'`).
- Tool UI parts: `type: 'tool-<name>'` (or `'dynamic-tool'` with `toolName`), `toolCallId`, `state: 'input-streaming' | 'input-available' | 'approval-requested' | 'approval-responded' | 'output-available' | 'output-error' | 'output-denied'`, `output` (when `output-available`), `errorText` (when `output-error`). Other parts: `text` (`text`, `state`), `reasoning`, `step-start`, `file`, `source-url`.

Dry run (2026-10-15): all code and edits of Tasks 1–8, applied in order to a throwaway worktree of `main`, passed `tsc -p tsconfig.app.json --noEmit`, `eslint` on the touched files, `vite build` and `bun test` (580 pass, incl. the 20 new tests). If a step does not apply cleanly, the file changed on `main` since then.

## Global Constraints

- Desktop only (the Intel window never renders on phones).
- **The AI never writes.** Only the user's click on "Zet als antwoord" changes data, through the existing `POST /hints/:articleId/:area/solve` (`useHintBoard().solve`).
- Contract names are binding: routes `GET|POST|DELETE /intel-chat/:articleId`; POST body exactly `{ message, web, deep }` with only the newest message; errors `400 invalid_message`, `404 not_found`, `429 rate_limited`, `503 ai_unavailable`; tool names/labels/tones and output shapes as in the contract table.
- A user message has one `text` part and at most one `file` part (`image/jpeg`, data URL, ≤ 2 MB decoded). The client resizes to max 1600 px JPEG q0.85; originals > 10 MB are refused with a toast.
- Every UI state change animates (enter/exit/swap); nothing pops. Use `motion/react` (never `framer-motion`), presets from `src/lib/motion.ts` (`SWAP`, `POP`, `EASE_OUT`, `SWAP_TRANSITION`, `REVEAL_TRANSITION`) and the chat presets added to `src/lib/intel-window.ts`; `Reveal` for lines that fold in/out. Streaming text is not animated per token.
- Tooltips: `@/components/ui/tooltip` (unified `radix-ui` package). Icons: `lucide-react`. No microphone/voice, no canvas mode, no document-wide paste listener, no injected `<style>` tag.
- Beheer look: card `bg-card rounded-[24px] p-3.5`; prompt box `bg-beheer-row-high rounded-[20px] p-1.5`, focus `ring-[3px] ring-ring/50`; Web on = `bg-fox-cooldown-container text-fox-on-cooldown`; Denk diep on = `bg-ai-think-container text-ai-on-think`; 12 px button corners (`rounded-xl` / `Pill`).
- Dutch UI copy exactly as written in this plan.
- Commands (bun is NOT on PATH): tests `npx --yes bun test <path>`; types + build `npm run build` (runs `vite build && tsc -b`); lint `npm run lint`.
- Branch `feat/intel-ai-chat` from `main` in `jotihunt-tracker-client`. Do not deploy. Commit messages end with a blank line + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

Create:
- `src/types/IntelChat.ts` — contract output shapes, tool name/tone types, `ChatModes`, request body type.
- `src/lib/intel-chat.ts` (+ `src/lib/intel-chat.test.ts`) — pure helpers: tool meta/labels/tones, tool-call flattening, output guards, summaries, status line, suggestion chips, context/placeholder copy, error kinds, request body, image checks, point cards, web sources, answer comparison.
- `src/stores/intel-chat.store.ts` — persisted Web / Denk diep per user id.
- `src/components/intel-window/chat/IntelChat.tsx` — the card: header, scenes (loading / load error / empty / thread), footer (input or "AI is niet ingesteld"), "Nieuw gesprek".
- `src/components/intel-window/chat/useIntelChat.ts` — `useIntelChat(articleId)` + `useChatModes()`.
- `src/components/intel-window/chat/stick-to-bottom.ts` — auto-scroll while streaming unless the user scrolled up.
- `src/components/intel-window/chat/prompt-input.tsx` — `PromptInput`, `PromptInputTextarea`, `PromptInputActions`, `PromptInputAction`, `ModeToggle`, `SendButton`.
- `src/components/intel-window/chat/ChatInput.tsx` — T1 prompt box with toggles, image attach, send/stop.
- `src/components/intel-window/chat/ChatMessage.tsx` — user bubble (+ image), assistant parts.
- `src/components/intel-window/chat/ChatMarkdown.tsx` — `react-markdown`, no raw HTML.
- `src/components/intel-window/chat/ChatEmpty.tsx` — E2 empty state with chips.
- `src/components/intel-window/chat/ToolStatus.tsx` — M3 running line.
- `src/components/intel-window/chat/ToolsUsed.tsx` — "N tools gebruikt ›" + expandable list; exports `ToolIcon`.
- `src/components/intel-window/chat/PointCard.tsx` — point/proposal card with "Toon op kaart" / "Zet als antwoord".
- `src/components/intel-window/chat/MiniMap.tsx` — non-interactive MapLibre map with a pin (mounted only near the viewport).
- `src/components/intel-window/chat/SourceChips.tsx` — web sources as chips.

Modify:
- `package.json`, `bun.lock` — new dependencies.
- `src/index.css` — `--color-fox-*-container` theme colours, `--ai-think-*` tokens, `.ai-shimmer`.
- `src/lib/intel-window.ts` — chat motion presets, `INTEL_CLOSE_MS`.
- `src/lib/image.ts` — `prepareChatImage`.
- `src/components/intel-window/IntelDialog.tsx` — `DetailView` two columns, `DetailColumn` full width.
- `src/components/intel-window/HintPane.tsx` — use the shared `INTEL_CLOSE_MS`.

---

### Task 1: Branch, dependencies, contract types and pure helpers

**Files:**
- Modify: `package.json`, `bun.lock`
- Create: `src/types/IntelChat.ts`, `src/lib/intel-chat.ts`, `src/lib/intel-chat.test.ts`

**Interfaces:**
- Consumes: `areaStates` from `@/lib/intel-window`, `areaOptions` from `@/lib/utils`, `scaledSize` from `@/lib/image` (test only), `IntelItem`/`IntelKind` from `@/types/Intel`.
- Produces (`src/types/IntelChat.ts`): `LatLng`, `Rd`, `AreaEstimate`, `NearGroup`, `PointResult`, `HintAnswerProposal`, `CheckPointResult`, `WebSearchResult`, `IntelToolName`, `ToolTone = 'app' | 'map' | 'web' | 'think'`, `ChatModes { web: boolean; deep: boolean }`, `IntelChatRequest { message: UIMessage; web: boolean; deep: boolean }`.
- Produces (`src/lib/intel-chat.ts`):
  - `TOOL_META: Record<IntelToolName, { label: string; tone: ToolTone }>`, `toolLabel(name: string): string`, `toolDoneLabel(name: string): string`, `toolTone(name: string): ToolTone`
  - `type ChatPart = UIMessage['parts'][number]`; `interface ChatToolCall { id: string; name: string; state: 'running' | 'done' | 'error'; output?: unknown; errorText?: string }`; `toolCallOf(part: ChatPart): ChatToolCall | null`; `toolCalls(message: UIMessage): ChatToolCall[]`
  - `isPointResult(value: unknown): value is PointResult`, `isHintAnswerProposal(value): value is HintAnswerProposal`, `isWebSearchResult(value): value is WebSearchResult`
  - `formatDistance(metres: number): string`, `areaLabel(area: string): string`
  - `toolSummary(call: ChatToolCall): string | null`, `stackedTools(calls: ChatToolCall[]): string[]`
  - `THINKING_LABEL`, `chatStatusLabel(messages: UIMessage[], status: ChatStatus): string | null`, `lastUserMessageId(messages: UIMessage[]): string | null`
  - `suggestionChips(item: Pick<IntelItem, 'kind' | 'cells'>): string[]`, `CONTEXT_LABEL: Record<IntelKind, string>`, `PLACEHOLDER: Record<IntelKind, string>`
  - `type ChatErrorKind = 'rate_limited' | 'ai_unavailable' | 'not_found' | 'other'`, `chatErrorKind(error: unknown): ChatErrorKind`, `RATE_LIMIT_MESSAGE`
  - `chatRequestBody(messages: UIMessage[], modes: ChatModes): IntelChatRequest`
  - `CHAT_IMAGE_MAX_SIDE = 1600`, `CHAT_IMAGE_QUALITY = 0.85`, `CHAT_IMAGE_MAX_ORIGINAL_BYTES`, `CHAT_IMAGE_MAX_BYTES`, `chatImageProblem(file: { type: string; size: number }): string | null`, `dataUrlBytes(url: string): number`
  - `interface ChatPointCard { id: string; point: PointResult | null; proposal?: HintAnswerProposal }`, `pointCards(message: UIMessage): ChatPointCard[]`
  - `interface ChatSource { title: string; url: string }`, `webSources(message: UIMessage): ChatSource[]`
  - `sameAnswer(a: string, b: string): boolean`

- [ ] **Step 1: Branch and baseline**

```bash
cd "/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client"
git checkout main && git pull --ff-only || true
git checkout -b feat/intel-ai-chat main
npx --yes bun test
```
Expected: all existing tests pass.

- [ ] **Step 2: Install the dependencies (exact versions: `@ai-sdk/react@4.0.145` depends on `ai@7.0.141` exactly)**

```bash
cd "/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client"
npx --yes bun add --exact ai@7.0.141 @ai-sdk/react@4.0.145 react-markdown@10.1.0
grep -n '"ai"\|"@ai-sdk/react"\|"react-markdown"' package.json
```
Expected: the three lines appear under `dependencies` with exact versions; `bun.lock` changed.

- [ ] **Step 3: Contract types**

Create `src/types/IntelChat.ts`:

```ts
import type { UIMessage } from 'ai';

/** Shapes of the intel chat contract (docs/superpowers/specs/2026-10-15-intel-ai-chat-contract.md). */

export type LatLng = { lat: number; lng: number };
export type Rd = { x: number; y: number };

export type AreaEstimate = {
  /** e.g. 'alpha'; null when unknown */
  area: string | null;
  method: 'hull' | 'nearest-group' | 'none';
};

export type NearGroup = { name: string; area: string | null; distanceM: number };

/** showPoint output */
export type PointResult = {
  label: string;
  latLng: LatLng;
  rd: Rd;
  /** formatRdAnswer, e.g. "152341 431112" */
  rdText: string;
  area: AreaEstimate;
  nearestGroup: NearGroup | null;
};

/** proposeHintAnswer output */
export type HintAnswerProposal = {
  articleId: number;
  area: string;
  /** Exactly what "Zet als antwoord" posts */
  answer: string;
  kind: 'rd' | 'text';
  /** Set when kind === 'rd' */
  point: PointResult | null;
};

/** checkPoint output */
export type CheckPointResult = {
  point: PointResult;
  nearestGroups: NearGroup[];
  insideNl: boolean;
  otherHintPoints: { articleTitle: string; slotTime: string | null; distanceM: number }[];
  nearestTracker: { name: string; distanceM: number; ageMin: number } | null;
};

/** webSearch output */
export type WebSearchResult = { answer: string; sources: { title: string; url: string }[] };

export type IntelToolName =
  | 'getItem'
  | 'searchIntel'
  | 'getHintBoard'
  | 'getAreas'
  | 'getFoxHistory'
  | 'getOurTeams'
  | 'convertCoordinates'
  | 'checkPoint'
  | 'nearbyGroups'
  | 'distance'
  | 'projectPoint'
  | 'geocode'
  | 'reverseGeocode'
  | 'webSearch'
  | 'readWebPage'
  | 'runCode'
  | 'showPoint'
  | 'proposeHintAnswer';

/** Icon colour of a tool: app data (warn), map (ok), web (cooldown), think (purple) */
export type ToolTone = 'app' | 'map' | 'web' | 'think';

/** Prompt box modes, kept per user */
export interface ChatModes {
  web: boolean;
  deep: boolean;
}

/** Body of POST /intel-chat/:articleId */
export interface IntelChatRequest {
  message: UIMessage;
  web: boolean;
  deep: boolean;
}
```

- [ ] **Step 4: Write the failing tests**

Create `src/lib/intel-chat.test.ts`:

```ts
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
  chatImageProblem,
  chatRequestBody,
  chatStatusLabel,
  dataUrlBytes,
  formatDistance,
  isHintAnswerProposal,
  isPointResult,
  lastUserMessageId,
  pointCards,
  sameAnswer,
  stackedTools,
  suggestionChips,
  toolCalls,
  toolDoneLabel,
  toolLabel,
  toolSummary,
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
    expect(Object.keys(TOOL_META)).toHaveLength(18);
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
    expect(chatStatusLabel([user('u1'), assistant({ type: 'reasoning', text: 'hmm' })], 'streaming')).toBe(THINKING_LABEL);
    expect(chatStatusLabel([user('u1'), assistant({ type: 'text', text: 'Bravo wijst' })], 'streaming')).toBeNull();
    expect(chatStatusLabel([user('u1'), assistant({ type: 'text', text: 'x' })], 'error')).toBeNull();
  });

  test('lastUserMessageId', () => {
    expect(lastUserMessageId([])).toBeNull();
    expect(lastUserMessageId([user('u1'), assistant(), user('u2'), assistant()])).toBe('u2');
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
  test('pointCards: finished showPoint and proposeHintAnswer outputs only', () => {
    const proposal = { articleId: 7, area: 'bravo', answer: '153020 430880', kind: 'rd', point };
    const message = assistant(
      tool('showPoint', 'output-available', { output: point }, 's1'),
      tool('showPoint', 'input-available', {}, 's2'),
      tool('proposeHintAnswer', 'output-available', { output: proposal }, 'p1'),
      tool('proposeHintAnswer', 'output-available', { output: { error: 'Onbekend gebied' } }, 'p2'),
    );
    expect(pointCards(message)).toEqual([
      { id: 's1', point },
      { id: 'p1', point, proposal },
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
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npx --yes bun test src/lib/intel-chat.test.ts`
Expected: FAIL — `Cannot find module './intel-chat'`.

- [ ] **Step 6: Implement the helpers**

Create `src/lib/intel-chat.ts`:

```ts
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
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx --yes bun test src/lib/intel-chat.test.ts`
Expected: PASS (all tests). Then `npx --yes bun test` — everything green.

- [ ] **Step 8: Type-check**

Run: `npm run build`
Expected: succeeds (no type errors; the new modules are not imported by the app yet).

- [ ] **Step 9: Commit**

```bash
git add package.json bun.lock src/types/IntelChat.ts src/lib/intel-chat.ts src/lib/intel-chat.test.ts
git commit -m "feat(intel-chat): contract types and pure chat helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Two-column detail and the chat card shell

**Files:**
- Modify: `src/index.css`, `src/lib/intel-window.ts`, `src/components/intel-window/IntelDialog.tsx`
- Create: `src/components/intel-window/chat/IntelChat.tsx` (shell; filled in Task 3)

**Interfaces:**
- Consumes: `CONTEXT_LABEL` (Task 1).
- Produces: Tailwind colours `bg-fox-ok-container`, `bg-fox-warn-container`, `bg-fox-cooldown-container`, `bg-fox-error-container`, `bg-ai-think-container`, `text-ai-on-think` (the `text-fox-on-*` ones already exist); `CHAT_CARD_ENTER` in `lib/intel-window.ts`; `IntelChat` default export with props `{ item: IntelItem; mapRef: RefObject<MapRef | null> }`.

- [ ] **Step 1: Theme tokens**

In `src/index.css`:

Replace `  --fox-chip: rgb(255 255 255 / 0.7);` with:
```css
  --fox-chip: rgb(255 255 255 / 0.7);
  /* Intel AI chat: "Denk diep" (M3 purple tonal pair) */
  --ai-think-container: #f2daff;
  --ai-on-think-container: #2c0051;
```

Replace `  --fox-chip: rgb(0 0 0 / 0.28);` with:
```css
  --fox-chip: rgb(0 0 0 / 0.28);
  --ai-think-container: #4f2a75;
  --ai-on-think-container: #f0dbff;
```

Replace `  --color-fox-chip: var(--fox-chip);` with:
```css
  --color-fox-chip: var(--fox-chip);
  /* Tonal containers (the -on- text colours above pair with them) */
  --color-fox-ok-container: var(--fox-ok-container);
  --color-fox-warn-container: var(--fox-warn-container);
  --color-fox-cooldown-container: var(--fox-cooldown-container);
  --color-fox-error-container: var(--fox-error-container);
  --color-ai-think-container: var(--ai-think-container);
  --color-ai-on-think: var(--ai-on-think-container);
```

- [ ] **Step 2: Card entrance preset**

In `src/lib/intel-window.ts` change the first motion import line `import type { Transition, Variants } from 'motion/react';` to:
```ts
import type { TargetAndTransition, Transition, Variants } from 'motion/react';
```
and append at the end of the file:
```ts
/** The AI chat card right of the item (layout B): slides in after the detail's parts when an item opens from the timeline */
export const CHAT_CARD_ENTER = {
  initial: { opacity: 0, x: 26, scale: 0.98 },
  animate: { opacity: 1, x: 0, scale: 1 },
  transition: { duration: 0.45, delay: 0.28, ease: EASE_OUT },
} satisfies { initial: TargetAndTransition; animate: TargetAndTransition; transition: Transition };
```

- [ ] **Step 3: The chat card shell**

Create `src/components/intel-window/chat/IntelChat.tsx`:

```tsx
import type { ReactNode, RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { MapRef } from '@/components/Map';
import { CONTEXT_LABEL } from '@/lib/intel-chat';
import type { IntelItem, IntelKind } from '@/types/Intel';

interface IntelChatProps {
  item: IntelItem;
  /** For "Toon op kaart" on point cards */
  mapRef: RefObject<MapRef | null>;
}

const FADE = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } };

/** The AI chat card right of the open item (layout B). Its content swaps (fades) when another item opens. */
export default function IntelChat({ item }: IntelChatProps) {
  return (
    <section aria-label="Vraag de AI" className="flex min-h-0 flex-1 flex-col rounded-[24px] bg-card p-3.5">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={item.id} {...FADE} className="flex min-h-0 flex-1 flex-col gap-2.5">
          <ChatHeader kind={item.kind} />
          <div className="min-h-0 flex-1" />
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function ChatHeader({ kind, action }: { kind: IntelKind; action?: ReactNode }) {
  return (
    <div className="mx-1 flex items-center gap-2">
      <span aria-hidden className="text-base leading-none text-fox-warn">
        ✦
      </span>
      <h3 className="text-[15px] font-bold">Vraag de AI</h3>
      <span className="ml-auto rounded-lg bg-beheer-row-high px-2 py-0.5 text-[11.5px] font-semibold text-muted-foreground">{CONTEXT_LABEL[kind]}</span>
      {action}
    </div>
  );
}
```

- [ ] **Step 4: Split the detail view**

In `src/components/intel-window/IntelDialog.tsx`:

Change `import { DETAIL_SWAP, buildIntelItems, filterByTab, unreadCount } from '@/lib/intel-window';` to:
```ts
import { CHAT_CARD_ENTER, DETAIL_SWAP, buildIntelItems, filterByTab, unreadCount } from '@/lib/intel-window';
```
and add after `import IntelTopBar from './IntelTopBar';`:
```ts
import IntelChat from './chat/IntelChat';
```

Replace the whole `DetailView` function (from `/** The open item over the full width: "Tijdlijn" back pill, then the item centred, scrolling on its own */` to its closing `}`) with:

```tsx
/**
 * The open item (layout B): left the item column ("Tijdlijn" pill floating over its top, scrolling on its own), right
 * the AI chat card over the full height. Opening from the timeline, the chat card slides in after the item's parts; going
 * back, it fades out with the rest of the view.
 */
function DetailView({ item, area, mapRef, skipEntrance, onBack }: { item: IntelItem; area: string | null; mapRef: RefObject<MapRef | null>; skipEntrance: boolean; onBack: () => void }) {
  const [skip] = useState(skipEntrance);
  return (
    <div className="flex min-h-0 flex-1 gap-4 pr-[18px] pb-[18px]">
      <div className="relative flex min-w-0 flex-[1.25] flex-col">
        {/* The scroller fills the column (a card high up in the timeline morphs in without being clipped at the top);
            the pill floats over its top, content scrolls away under the fade */}
        <motion.div layoutScroll className="min-h-0 flex-1 overflow-y-auto pt-12 pr-2 pb-8 pl-[26px] [scrollbar-gutter:stable]">
          <DetailColumn item={item} area={area} mapRef={mapRef} skipEntrance={skip} />
        </motion.div>
        <motion.div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-12 items-start bg-linear-to-b from-beheer-window from-70% to-transparent pl-6"
          initial={skip ? false : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0, transition: { duration: 0.3, delay: 0.12, ease: EASE_OUT } }}
        >
          <Pill className="pointer-events-auto" onClick={onBack} title="Terug naar de tijdlijn (Esc)">
            <ArrowLeftIcon />
            Tijdlijn
          </Pill>
        </motion.div>
      </div>
      <motion.div className="flex min-w-0 flex-1 flex-col" initial={skip ? false : CHAT_CARD_ENTER.initial} animate={CHAT_CARD_ENTER.animate} transition={CHAT_CARD_ENTER.transition}>
        <IntelChat item={item} mapRef={mapRef} />
      </motion.div>
    </div>
  );
}
```

In `DetailColumn` replace:
```tsx
      {/* An opdracht is wider (status and notes side by side); the others stay at a comfortable reading width */}
      <DetailSlide key={item.id} swapped={swapped} skipEntrance={skipEntrance && !swapped} className={item.kind === 'assignment' ? 'max-w-[960px]' : 'max-w-[760px]'}>
```
with:
```tsx
      {/* Full column width; an opdracht stacks status and notes when the column is narrow (@container in AssignmentPane) */}
      <DetailSlide key={item.id} swapped={swapped} skipEntrance={skipEntrance && !swapped} className="w-full">
```

- [ ] **Step 5: Build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 6: Browser check**

Run `npm run dev` (uses `.env.local`), log in, open Intel, open a hint from the timeline. Expected: item left (~55%), card "✦ Vraag de AI · ziet deze hint" right over the full height, sliding in from the right ~0.28 s after the header morph; opening an opdracht shows "ziet deze opdracht" and status/notes stacked; another item via the mini grid fades the card content; "Tijdlijn" fades the whole view out. The left column clips the wide timeline card's right edge during the 0.42 s morph — acceptable.

- [ ] **Step 7: Commit**

```bash
git add src/index.css src/lib/intel-window.ts src/components/intel-window/IntelDialog.tsx src/components/intel-window/chat/IntelChat.tsx
git commit -m "feat(intel-chat): two-column item detail with the AI chat card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Chat end to end (history, prompt box, messages, status, errors)

**Files:**
- Create: `src/stores/intel-chat.store.ts`, `src/components/intel-window/chat/useIntelChat.ts`, `src/components/intel-window/chat/stick-to-bottom.ts`, `src/components/intel-window/chat/prompt-input.tsx`, `src/components/intel-window/chat/ChatInput.tsx`, `src/components/intel-window/chat/ChatMarkdown.tsx`, `src/components/intel-window/chat/ChatMessage.tsx`, `src/components/intel-window/chat/ToolStatus.tsx`
- Modify: `src/lib/intel-window.ts`, `src/components/intel-window/chat/IntelChat.tsx`

**Interfaces:**
- Consumes: `chatRequestBody`, `chatErrorKind`, `RATE_LIMIT_MESSAGE`, `chatStatusLabel`, `lastUserMessageId`, `PLACEHOLDER`, `CONTEXT_LABEL` (Task 1); `useAuthSWR`, `fetcherWithMethod` (`src/lib/swr.ts`).
- Produces:
  - `useIntelChatStore` (default) + `DEFAULT_CHAT_MODES: ChatModes = { web: true, deep: false }`.
  - `useChatModes(): [ChatModes, (mode: keyof ChatModes, on: boolean) => void]`.
  - `useIntelChat(articleId: number)` returning `{ messages: UIMessage[]; status: ChatStatus; loading: boolean; loadError: boolean; unavailable: boolean; send(text: string, image?: FileUIPart): void; retry(): void; stop(): void; reload(): void; reset(): Promise<void> }`; `type IntelChatState = ReturnType<typeof useIntelChat>`.
  - `useStickToBottom(pinKey: unknown)` → `{ scrollerRef, contentRef, onScroll }`.
  - `prompt-input.tsx`: `PromptInput`, `PromptInputTextarea`, `PromptInputActions`, `PromptInputAction`, `ModeToggle`, `SendButton`.
  - `ChatInput` props `{ kind: IntelKind; busy: boolean; disabled: boolean; onSend: (text: string) => void; onStop: () => void }` (Task 6 widens `onSend`).
  - `ChatMessage` props `{ message: UIMessage; streaming: boolean; mapRef: RefObject<MapRef | null> }`.
  - `ToolStatus` props `{ label: string | null }`.
  - `CHAT_MESSAGE`, `TOGGLE_SPRING` in `lib/intel-window.ts`.

- [ ] **Step 1: Motion presets**

Append to `src/lib/intel-window.ts`:
```ts
/** A chat message rising in (streaming text itself is not animated per token) */
export const CHAT_MESSAGE = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, transition: { duration: 0.15 } },
  transition: { duration: 0.3, ease: EASE_OUT },
} satisfies { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition; transition: Transition };

/** Prompt box toggles: the icon turns once and grows a little when switched on */
export const TOGGLE_SPRING: Transition = { type: 'spring', stiffness: 260, damping: 25 };
```

- [ ] **Step 2: Mode store (per user, localStorage)**

Create `src/stores/intel-chat.store.ts`:
```ts
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ChatModes } from '@/types/IntelChat';

/** Web on (the web tools only run when the AI needs them), Denk diep off (slower, pricier model) */
export const DEFAULT_CHAT_MODES: ChatModes = { web: true, deep: false };

interface IntelChatState {
  /** Per user id: the prompt box modes */
  modes: Record<string, ChatModes>;
  setMode: (userId: string, mode: keyof ChatModes, on: boolean) => void;
}

const useIntelChatStore = create<IntelChatState>()(
  persist(
    (set) => ({
      modes: {},
      setMode: (userId, mode, on) => set((state) => ({ modes: { ...state.modes, [userId]: { ...(state.modes[userId] ?? DEFAULT_CHAT_MODES), [mode]: on } } })),
    }),
    { name: 'intel-chat-modes', storage: createJSONStorage(() => localStorage) },
  ),
);

export default useIntelChatStore;
```

- [ ] **Step 3: The chat hook**

Create `src/components/intel-window/chat/useIntelChat.ts`:
```ts
import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type FileUIPart, type UIMessage } from 'ai';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { toast } from 'sonner';
import { RATE_LIMIT_MESSAGE, chatErrorKind, chatRequestBody } from '@/lib/intel-chat';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import useIntelChatStore, { DEFAULT_CHAT_MODES } from '@/stores/intel-chat.store';
import type { ChatModes } from '@/types/IntelChat';
import type { User } from '@/types/User';

/** The prompt box modes of the logged-in user (kept in localStorage per user) */
export function useChatModes(): [ChatModes, (mode: keyof ChatModes, on: boolean) => void] {
  const userId = useAuthUser<User>()?._id ?? 'anon';
  const modes = useIntelChatStore((state) => state.modes[userId]) ?? DEFAULT_CHAT_MODES;
  const setMode = useIntelChatStore((state) => state.setMode);
  return [modes, (mode, on) => setMode(userId, mode, on)];
}

/**
 * One item's conversation (per user, stored on the server). History comes from GET /intel-chat/:id and is put into the
 * chat until the user does something in this mount; a send posts only the newest message plus the modes (contract).
 * Unmounting (another item, back to the timeline) stops a running stream; the server keeps what was produced.
 */
export function useIntelChat(articleId: number) {
  const authHeader = useAuthHeader() || '';
  const [modes] = useChatModes();
  const path = `/intel-chat/${articleId}`;
  const history = useAuthSWR<{ messages: UIMessage[] }>(path, { revalidateOnFocus: false });
  const { mutate } = history;
  const [postUnavailable, setPostUnavailable] = useState(false);

  // useChat reads the transport of the latest render on every send, so a new token or mode applies right away
  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: `${import.meta.env.API_BASE_URL}${path}`,
        prepareSendMessagesRequest: ({ messages }) => ({ body: chatRequestBody(messages, modes), headers: { Authorization: authHeader } }),
      }),
    [path, authHeader, modes],
  );

  const chat = useChat({
    id: `intel-${articleId}`,
    transport,
    onError: (error) => {
      const kind = chatErrorKind(error);
      if (kind === 'rate_limited') toast.error(RATE_LIMIT_MESSAGE);
      if (kind === 'ai_unavailable') setPostUnavailable(true);
    },
    // Keep the cached history in step, so coming back to this item shows the whole conversation at once
    onFinish: ({ messages }) => void mutate({ messages }, { revalidate: false }),
  });
  const { setMessages, sendMessage, regenerate, stop, clearError } = chat;

  // History (cached or fresh) goes into the chat until the user sent, retried or reset something in this mount
  const touched = useRef(false);
  useEffect(() => {
    if (!history.data || touched.current) return;
    setMessages(Array.isArray(history.data.messages) ? history.data.messages : []);
  }, [history.data, setMessages]);

  const loadKind = history.error ? chatErrorKind(history.error) : null;
  return {
    messages: chat.messages,
    status: chat.status,
    loading: !history.data && !history.error,
    loadError: loadKind !== null && loadKind !== 'ai_unavailable',
    unavailable: postUnavailable || loadKind === 'ai_unavailable',
    send(text: string, image?: FileUIPart) {
      touched.current = true;
      void sendMessage(image ? { text, files: [image] } : { text });
    },
    retry() {
      touched.current = true;
      void regenerate();
    },
    stop() {
      void stop();
    },
    reload() {
      void mutate();
    },
    /** "Nieuw gesprek": stop, clear on the server, then locally */
    async reset() {
      touched.current = true;
      await stop();
      await fetcherWithMethod(path, authHeader, 'DELETE');
      setMessages([]);
      clearError();
      await mutate({ messages: [] }, { revalidate: false });
    },
  };
}

export type IntelChatState = ReturnType<typeof useIntelChat>;
```

- [ ] **Step 4: Auto-scroll**

Create `src/components/intel-window/chat/stick-to-bottom.ts`:
```ts
import { useEffect, useLayoutEffect, useRef } from 'react';

/** Within this many px of the bottom counts as "at the bottom" */
const STICK_SLACK_PX = 40;

/**
 * Keeps a scroller at its bottom while its content grows (streaming), unless the user scrolled up to read; a change of
 * `pinKey` (the newest user message) pins it to the bottom again.
 */
export function useStickToBottom(pinKey: unknown) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stuck = useRef(true);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    scroller.scrollTop = scroller.scrollHeight;
    const observer = new ResizeObserver(() => {
      if (stuck.current) scroller.scrollTop = scroller.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    stuck.current = true;
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [pinKey]);

  function onScroll() {
    const scroller = scrollerRef.current;
    if (scroller) stuck.current = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < STICK_SLACK_PX;
  }

  return { scrollerRef, contentRef, onScroll };
}
```

- [ ] **Step 5: The PromptInput compound (restyled T1)**

Create `src/components/intel-window/chat/prompt-input.tsx`:
```tsx
import { createContext, useContext, useLayoutEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpIcon, SquareIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TOGGLE_SPRING } from '@/lib/intel-window';
import { POP_SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface PromptInputContextValue {
  value: string;
  setValue: (value: string) => void;
  maxHeight: number;
  onSubmit?: () => void;
  disabled: boolean;
}

const PromptInputContext = createContext<PromptInputContextValue | null>(null);

function usePromptInput() {
  const context = useContext(PromptInputContext);
  if (!context) throw new Error('PromptInput parts must be inside <PromptInput>');
  return context;
}

interface PromptInputProps extends Omit<ComponentProps<'div'>, 'onSubmit'> {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit?: () => void;
  /** The textarea grows with its text up to this height, then scrolls */
  maxHeight?: number;
  disabled?: boolean;
}

/** T1 prompt box: tonal container (no border), orange focus ring; textarea on top, the actions row below */
export function PromptInput({ value, onValueChange, onSubmit, maxHeight = 160, disabled = false, className, children, ...props }: PromptInputProps) {
  return (
    <PromptInputContext.Provider value={{ value, setValue: onValueChange, maxHeight, onSubmit, disabled }}>
      <div className={cn('rounded-[20px] bg-beheer-row-high p-1.5 transition-shadow duration-200 focus-within:ring-[3px] focus-within:ring-ring/50', className)} {...props}>
        {children}
      </div>
    </PromptInputContext.Provider>
  );
}

/** Autosizing textarea: Enter sends, Shift+Enter is a new line */
export function PromptInputTextarea({ className, onKeyDown, ...props }: Omit<ComponentProps<'textarea'>, 'value' | 'onChange'>) {
  const { value, setValue, maxHeight, onSubmit, disabled } = usePromptInput();
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
  }, [value, maxHeight]);
  return (
    <textarea
      {...props}
      ref={ref}
      rows={1}
      value={value}
      disabled={disabled}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault();
          onSubmit?.();
        }
      }}
      className={cn(
        'block min-h-[38px] w-full resize-none overflow-y-auto bg-transparent px-2.5 py-2 text-[13.5px] leading-snug outline-none placeholder:text-muted-foreground disabled:opacity-60',
        className,
      )}
    />
  );
}

export function PromptInputActions({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex items-center gap-1', className)} {...props} />;
}

/** Tooltip around one action (a native or motion element, so the trigger gets its ref) */
export function PromptInputAction({ tooltip, children, side = 'top' }: { tooltip: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

const TOGGLE_ON: Record<'web' | 'think', string> = {
  web: 'bg-fox-cooldown-container text-fox-on-cooldown',
  think: 'bg-ai-think-container text-ai-on-think',
};

interface ModeToggleProps {
  on: boolean;
  onToggle: (on: boolean) => void;
  icon: ReactNode;
  label: string;
  tone: 'web' | 'think';
  tooltip: ReactNode;
}

/** A mode: icon only when off; on, it fills with its tonal pair, the icon turns once and the label slides out */
export function ModeToggle({ on, onToggle, icon, label, tone, tooltip }: ModeToggleProps) {
  return (
    <PromptInputAction tooltip={tooltip}>
      <button
        type="button"
        aria-pressed={on}
        aria-label={label}
        onClick={() => onToggle(!on)}
        className={cn(
          'flex h-8 items-center rounded-xl px-2 text-[12.5px] font-semibold outline-none transition-colors duration-200 focus-visible:ring-[3px] focus-visible:ring-ring/50',
          on ? TOGGLE_ON[tone] : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
        )}
      >
        <motion.span className="grid place-items-center [&_svg]:size-4" initial={false} animate={{ rotate: on ? 360 : 0, scale: on ? 1.08 : 1 }} transition={TOGGLE_SPRING}>
          {icon}
        </motion.span>
        <AnimatePresence initial={false}>
          {on && (
            <motion.span
              key="label"
              className="overflow-hidden whitespace-nowrap"
              initial={{ width: 0, opacity: 0, marginLeft: 0 }}
              animate={{ width: 'auto', opacity: 1, marginLeft: 6 }}
              exit={{ width: 0, opacity: 0, marginLeft: 0 }}
              transition={{ duration: 0.28, ease: [0.2, 0, 0, 1], opacity: { duration: 0.2 } }}
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </PromptInputAction>
  );
}

/** Idle: muted arrow (disabled); ready: orange arrow; busy: stop square. The icon swaps with a turn. */
export function SendButton({ state, onSend, onStop }: { state: 'idle' | 'ready' | 'busy'; onSend: () => void; onStop: () => void }) {
  const busy = state === 'busy';
  return (
    <PromptInputAction tooltip={busy ? 'Stoppen' : 'Versturen (Enter)'}>
      <motion.button
        type="button"
        aria-label={busy ? 'Stoppen' : 'Versturen'}
        disabled={state === 'idle'}
        onClick={busy ? onStop : onSend}
        animate={{ scale: state === 'ready' ? 1.04 : 1 }}
        transition={POP_SPRING}
        className={cn(
          'ml-auto grid size-[34px] place-items-center rounded-xl outline-none transition-colors duration-200 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none',
          state === 'idle' ? 'text-muted-foreground' : 'bg-primary text-primary-foreground hover:bg-primary/90',
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={busy ? 'stop' : 'send'}
            className="grid place-items-center"
            initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
            transition={{ duration: 0.18 }}
          >
            {busy ? <SquareIcon className="size-3.5 fill-current" /> : <ArrowUpIcon className="size-4" />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </PromptInputAction>
  );
}
```

- [ ] **Step 6: The chat input (text + toggles; image comes in Task 6)**

Create `src/components/intel-window/chat/ChatInput.tsx`:
```tsx
import { useState } from 'react';
import { BrainIcon, GlobeIcon } from 'lucide-react';
import { PLACEHOLDER } from '@/lib/intel-chat';
import type { IntelKind } from '@/types/Intel';
import { ModeToggle, PromptInput, PromptInputActions, PromptInputTextarea, SendButton } from './prompt-input';
import { useChatModes } from './useIntelChat';

interface ChatInputProps {
  kind: IntelKind;
  /** A turn is running: the send button stops it; typing goes on */
  busy: boolean;
  /** History not there yet (or failed): nothing can be sent */
  disabled: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

/** T1 prompt box: textarea, Web and Denk diep (kept per user), send ↔ stop */
export default function ChatInput({ kind, busy, disabled, onSend, onStop }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [modes, setMode] = useChatModes();
  const ready = !busy && !disabled && value.trim() !== '';

  function submit() {
    if (!ready) return;
    onSend(value.trim());
    setValue('');
  }

  return (
    <PromptInput value={value} onValueChange={setValue} onSubmit={submit} disabled={disabled}>
      <PromptInputTextarea
        placeholder={PLACEHOLDER[kind]}
        aria-label="Vraag aan de AI"
        maxLength={4000}
        // A draft: Escape clears it instead of leaving the item (keepOpenWhileEditing)
        data-inline-edit={value ? '' : undefined}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.stopPropagation();
            setValue('');
          }
        }}
      />
      <PromptInputActions className="pt-0.5">
        <ModeToggle tone="web" on={modes.web} onToggle={(on) => setMode('web', on)} icon={<GlobeIcon />} label="Web" tooltip="Web: mag op internet zoeken" />
        <span aria-hidden className="mx-0.5 h-4 w-px bg-foreground/10" />
        <ModeToggle tone="think" on={modes.deep} onToggle={(on) => setMode('deep', on)} icon={<BrainIcon />} label="Denk diep" tooltip="Denk diep: sterker model, duurt langer" />
        <SendButton state={busy ? 'busy' : ready ? 'ready' : 'idle'} onSend={submit} onStop={onStop} />
      </PromptInputActions>
    </PromptInput>
  );
}
```

- [ ] **Step 7: Markdown, messages and the status line**

Create `src/components/intel-window/chat/ChatMarkdown.tsx`:
```tsx
import { memo } from 'react';
import Markdown, { type Components } from 'react-markdown';

/** Links open in a new tab; raw HTML in the answer is never rendered (react-markdown default, no rehype-raw) */
const COMPONENTS: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

/** An assistant answer as markdown in the chat's text look */
function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="text-[13px] leading-[1.55] break-words [&_a]:text-primary [&_a]:underline [&_code]:rounded-md [&_code]:bg-beheer-row-high [&_code]:px-1 [&_code]:font-mono [&_code]:text-[12px] [&_h1]:my-2 [&_h1]:text-[15px] [&_h1]:font-bold [&_h2]:my-2 [&_h2]:text-[14px] [&_h2]:font-bold [&_h3]:my-1.5 [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-beheer-row-high [&_pre]:p-2.5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
      <Markdown components={COMPONENTS}>{text}</Markdown>
    </div>
  );
}

export default memo(ChatMarkdown);
```

Create `src/components/intel-window/chat/ChatMessage.tsx`:
```tsx
import type { RefObject } from 'react';
import type { TextUIPart, UIMessage } from 'ai';
import type { MapRef } from '@/components/Map';
import type { ChatPart } from '@/lib/intel-chat';
import ChatMarkdown from './ChatMarkdown';

interface ChatMessageProps {
  message: UIMessage;
  /** This assistant message is the one streaming now */
  streaming: boolean;
  /** For "Toon op kaart" on point cards */
  mapRef: RefObject<MapRef | null>;
}

const isText = (part: ChatPart): part is TextUIPart => part.type === 'text';

/** User bubble on the right; an assistant message as markdown text */
export default function ChatMessage({ message }: ChatMessageProps) {
  const texts = message.parts.filter(isText).filter((part) => part.text.trim() !== '');
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[16px_16px_6px_16px] bg-beheer-row-high px-3 py-2 text-[13px] break-words whitespace-pre-wrap">{texts.map((part) => part.text).join('\n')}</div>
      </div>
    );
  }
  return (
    <div className="mx-1 flex flex-col gap-2">
      {texts.map((part, index) => (
        <ChatMarkdown key={index} text={part.text} />
      ))}
    </div>
  );
}
```

Create `src/components/intel-window/chat/ToolStatus.tsx`:
```tsx
import { AnimatePresence, motion } from 'motion/react';
import { Loader2Icon } from 'lucide-react';
import Reveal from '@/components/motion/Reveal';
import { SWAP_TRANSITION } from '@/lib/motion';

/** M3: one line while the AI works (spinner + the running tool's label); the text swaps, the line folds in and away */
export default function ToolStatus({ label }: { label: string | null }) {
  return (
    <Reveal>
      {label && (
        <div className="mx-1 flex items-center gap-2 py-0.5 text-[12.5px]" role="status">
          <Loader2Icon className="size-3.5 shrink-0 animate-spin text-fox-warn" aria-hidden />
          <span className="relative min-w-0">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={label} className="inline-block text-muted-foreground" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={SWAP_TRANSITION}>
                {label}
              </motion.span>
            </AnimatePresence>
          </span>
        </div>
      )}
    </Reveal>
  );
}
```

- [ ] **Step 8: Wire the card**

Replace `src/components/intel-window/chat/IntelChat.tsx` with:
```tsx
import type { ReactNode, RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2Icon, RotateCcwIcon } from 'lucide-react';
import { Pill } from '@/components/beheer/controls/Pill';
import type { MapRef } from '@/components/Map';
import Reveal from '@/components/motion/Reveal';
import { CONTEXT_LABEL, chatStatusLabel, lastUserMessageId } from '@/lib/intel-chat';
import { CHAT_MESSAGE } from '@/lib/intel-window';
import { SWAP } from '@/lib/motion';
import type { IntelItem, IntelKind } from '@/types/Intel';
import ChatInput from './ChatInput';
import ChatMessage from './ChatMessage';
import ToolStatus from './ToolStatus';
import { useStickToBottom } from './stick-to-bottom';
import { type IntelChatState, useIntelChat } from './useIntelChat';

interface IntelChatProps {
  item: IntelItem;
  /** For "Toon op kaart" on point cards */
  mapRef: RefObject<MapRef | null>;
}

const FADE = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } };

/** The AI chat card right of the open item (layout B). Its content swaps (fades) when another item opens; each item has its own conversation. */
export default function IntelChat({ item, mapRef }: IntelChatProps) {
  return (
    <section aria-label="Vraag de AI" className="flex min-h-0 flex-1 flex-col rounded-[24px] bg-card p-3.5">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={item.id} {...FADE} className="flex min-h-0 flex-1 flex-col gap-2.5">
          <ChatPanel item={item} mapRef={mapRef} />
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function ChatPanel({ item, mapRef }: IntelChatProps) {
  const chat = useIntelChat(item.id);
  const busy = chat.status === 'submitted' || chat.status === 'streaming';
  const scene = chat.loading ? 'loading' : chat.loadError ? 'load-error' : 'thread';
  return (
    <>
      <ChatHeader kind={item.kind} />
      <AnimatePresence mode="wait" initial={false}>
        {scene === 'loading' ? (
          <motion.div key="loading" {...FADE} className="grid min-h-0 flex-1 place-items-center">
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" aria-label="Gesprek laden…" />
          </motion.div>
        ) : scene === 'load-error' ? (
          <motion.div key="load-error" {...FADE} className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-[13px] text-muted-foreground">
            Gesprek laden mislukt
            <Pill onClick={chat.reload}>
              <RotateCcwIcon />
              Opnieuw
            </Pill>
          </motion.div>
        ) : (
          <motion.div key="thread" {...FADE} className="flex min-h-0 flex-1 flex-col">
            <ChatThread chat={chat} mapRef={mapRef} />
          </motion.div>
        )}
      </AnimatePresence>
      <ChatFooter chat={chat} kind={item.kind} busy={busy} />
    </>
  );
}

function ChatHeader({ kind, action }: { kind: IntelKind; action?: ReactNode }) {
  return (
    <div className="mx-1 flex items-center gap-2">
      <span aria-hidden className="text-base leading-none text-fox-warn">
        ✦
      </span>
      <h3 className="text-[15px] font-bold">Vraag de AI</h3>
      <span className="ml-auto rounded-lg bg-beheer-row-high px-2 py-0.5 text-[11.5px] font-semibold text-muted-foreground">{CONTEXT_LABEL[kind]}</span>
      {action}
    </div>
  );
}

/** Messages (rise in), the status line while the AI works, and an error row with "Opnieuw" */
function ChatThread({ chat, mapRef }: { chat: IntelChatState; mapRef: RefObject<MapRef | null> }) {
  const { scrollerRef, contentRef, onScroll } = useStickToBottom(lastUserMessageId(chat.messages));
  const busy = chat.status === 'submitted' || chat.status === 'streaming';
  const last = chat.messages.at(-1);
  return (
    <div ref={scrollerRef} onScroll={onScroll} className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 [scrollbar-gutter:stable]">
      <div ref={contentRef} className="flex min-h-full flex-col justify-end gap-3 py-1">
        <AnimatePresence initial={false}>
          {chat.messages.map((message) => (
            <motion.div key={message.id} {...CHAT_MESSAGE}>
              <ChatMessage message={message} streaming={busy && message === last} mapRef={mapRef} />
            </motion.div>
          ))}
        </AnimatePresence>
        <ToolStatus label={chatStatusLabel(chat.messages, chat.status)} />
        <Reveal>{chat.status === 'error' && !chat.unavailable && <ErrorRow onRetry={chat.retry} />}</Reveal>
      </div>
    </div>
  );
}

function ErrorRow({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-1 flex items-center gap-2 rounded-xl bg-destructive/12 py-1.5 pr-1.5 pl-3 text-[12.5px] text-destructive dark:text-red-300">
      <span className="flex-1">Er ging iets mis</span>
      <Pill variant="danger-soft" onClick={onRetry}>
        <RotateCcwIcon />
        Opnieuw
      </Pill>
    </div>
  );
}

/** The prompt box, or "AI is niet ingesteld" when the server has no Gemini key (503) */
function ChatFooter({ chat, kind, busy }: { chat: IntelChatState; kind: IntelKind; busy: boolean }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {chat.unavailable ? (
        <motion.div key="off" {...SWAP} className="rounded-[20px] bg-beheer-row-high px-3.5 py-3 text-[13px] text-muted-foreground">
          AI is niet ingesteld
        </motion.div>
      ) : (
        <motion.div key="input" {...SWAP}>
          <ChatInput kind={kind} busy={busy} disabled={chat.loading || chat.loadError} onSend={chat.send} onStop={chat.stop} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 9: Build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 10: Smoke check without the AI server**

`npm run dev` against the live API (`.env.local`; it has no `/intel-chat` yet). Open a hint. Expected: the spinner fades to "Gesprek laden mislukt" + "Opnieuw" (404 from the old server); the prompt box shows (disabled). Typing is impossible while disabled; Web/Denk diep toggle (icon turns, label slides out, colour fills) and stay after a reload. The real round trip is verified in Task 9.

- [ ] **Step 11: Commit**

```bash
git add src/lib/intel-window.ts src/stores/intel-chat.store.ts src/components/intel-window/chat
git commit -m "feat(intel-chat): chat hook, T1 prompt box, messages and status line

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Empty state (E2) and "Nieuw gesprek"

**Files:**
- Create: `src/components/intel-window/chat/ChatEmpty.tsx`
- Modify: `src/lib/intel-window.ts`, `src/components/intel-window/chat/IntelChat.tsx`

**Interfaces:**
- Consumes: `suggestionChips` (Task 1), `useIntelChat().reset/send` (Task 3), `ConfirmDialog`.
- Produces: `ChatEmpty` props `{ item: IntelItem; disabled: boolean; onPick: (text: string) => void; delay?: number }`; `CHAT_EMPTY`, `CHAT_EMPTY_PART` variants (custom = delay in s).

- [ ] **Step 1: Variants**

Append to `src/lib/intel-window.ts`:
```ts
/** The chat's empty state: its parts stagger in 70 ms apart; custom = delay in seconds before the first */
export const CHAT_EMPTY: Variants = {
  hidden: {},
  shown: (delay: number = 0) => ({ transition: { staggerChildren: 0.07, delayChildren: delay } }),
};
export const CHAT_EMPTY_PART: Variants = {
  hidden: { opacity: 0, y: 8 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } },
};
```

- [ ] **Step 2: The empty state**

Create `src/components/intel-window/chat/ChatEmpty.tsx`:
```tsx
import { AnimatePresence, motion } from 'motion/react';
import { suggestionChips } from '@/lib/intel-chat';
import { CHAT_EMPTY, CHAT_EMPTY_PART } from '@/lib/intel-window';
import { POP } from '@/lib/motion';
import type { IntelItem } from '@/types/Intel';

interface ChatEmptyProps {
  item: IntelItem;
  /** A turn is running or the AI is not set up: chips can't send */
  disabled: boolean;
  /** A chip was clicked: send its text */
  onPick: (text: string) => void;
  /** Seconds before the parts stagger in (after the card's entrance) */
  delay?: number;
}

/** E2: centred tonal ✦ block, "Samen puzzelen", one line, chips per kind (a solved area's chip pops out) */
export default function ChatEmpty({ item, disabled, onPick, delay = 0 }: ChatEmptyProps) {
  const chips = suggestionChips(item);
  return (
    <motion.div variants={CHAT_EMPTY} custom={delay} initial="hidden" animate="shown" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2.5 px-4 text-center">
      <motion.div variants={CHAT_EMPTY_PART} aria-hidden className="grid size-[54px] place-items-center rounded-[18px] bg-fox-warn-container text-[26px] text-fox-on-warn">
        ✦
      </motion.div>
      <motion.p variants={CHAT_EMPTY_PART} className="text-[15px] font-bold">
        Samen puzzelen
      </motion.p>
      <motion.p variants={CHAT_EMPTY_PART} className="max-w-[260px] text-[12.5px] leading-relaxed text-muted-foreground">
        Ik ken dit item, de kaart, groepen en vossen, en kan op internet zoeken.
      </motion.p>
      <motion.div variants={CHAT_EMPTY_PART} className="relative mt-1 flex flex-wrap justify-center gap-1.5">
        <AnimatePresence initial={false} mode="popLayout">
          {chips.map((chip) => (
            <motion.button
              key={chip}
              layout
              {...POP}
              type="button"
              disabled={disabled}
              onClick={() => onPick(chip)}
              style={{ borderRadius: 12 }}
              className="bg-beheer-row-high px-2.5 py-1.5 text-xs font-semibold outline-none transition-colors hover:bg-beheer-row-high/70 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
            >
              {chip}
            </motion.button>
          ))}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
```

- [ ] **Step 3: Scenes + "Nieuw gesprek" in the card**

In `src/components/intel-window/chat/IntelChat.tsx`:

Replace the import block (lines from `import type { ReactNode, RefObject } from 'react';` to `import { type IntelChatState, useIntelChat } from './useIntelChat';`) with:
```tsx
import { type ReactNode, type RefObject, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2Icon, RotateCcwIcon, SquarePenIcon } from 'lucide-react';
import { toast } from 'sonner';
import { IconPill, Pill } from '@/components/beheer/controls/Pill';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { MapRef } from '@/components/Map';
import Reveal from '@/components/motion/Reveal';
import { apiErrorMessage } from '@/lib/api-error';
import { CONTEXT_LABEL, chatStatusLabel, lastUserMessageId } from '@/lib/intel-chat';
import { CHAT_MESSAGE } from '@/lib/intel-window';
import { POP, SWAP } from '@/lib/motion';
import type { IntelItem, IntelKind } from '@/types/Intel';
import ChatEmpty from './ChatEmpty';
import ChatInput from './ChatInput';
import ChatMessage from './ChatMessage';
import ToolStatus from './ToolStatus';
import { useStickToBottom } from './stick-to-bottom';
import { type IntelChatState, useIntelChat } from './useIntelChat';
```

Replace the whole `ChatPanel` function with:
```tsx
function ChatPanel({ item, mapRef }: IntelChatProps) {
  const chat = useIntelChat(item.id);
  const [confirmReset, setConfirmReset] = useState(false);
  const busy = chat.status === 'submitted' || chat.status === 'streaming';
  const scene = chat.loading ? 'loading' : chat.loadError ? 'load-error' : chat.messages.length === 0 ? 'empty' : 'thread';

  async function reset() {
    try {
      await chat.reset();
      setConfirmReset(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Gesprek wissen mislukt'));
    }
  }

  return (
    <>
      <ChatHeader
        kind={item.kind}
        action={
          <AnimatePresence initial={false}>
            {chat.messages.length > 0 && (
              <motion.span key="new" {...POP} className="-my-1.5 inline-grid">
                <IconPill aria-label="Nieuw gesprek" title="Nieuw gesprek" onClick={() => setConfirmReset(true)}>
                  <SquarePenIcon />
                </IconPill>
              </motion.span>
            )}
          </AnimatePresence>
        }
      />
      {/* Nieuw gesprek: the thread fades out, the empty state rises in */}
      <AnimatePresence mode="wait" initial={false}>
        {scene === 'loading' ? (
          <motion.div key="loading" {...FADE} className="grid min-h-0 flex-1 place-items-center">
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" aria-label="Gesprek laden…" />
          </motion.div>
        ) : scene === 'load-error' ? (
          <motion.div key="load-error" {...FADE} className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-[13px] text-muted-foreground">
            Gesprek laden mislukt
            <Pill onClick={chat.reload}>
              <RotateCcwIcon />
              Opnieuw
            </Pill>
          </motion.div>
        ) : scene === 'empty' ? (
          <motion.div key="empty" className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <ChatEmpty item={item} disabled={busy || chat.unavailable} onPick={chat.send} />
          </motion.div>
        ) : (
          <motion.div key="thread" {...FADE} className="flex min-h-0 flex-1 flex-col">
            <ChatThread chat={chat} mapRef={mapRef} />
          </motion.div>
        )}
      </AnimatePresence>
      <ChatFooter chat={chat} kind={item.kind} busy={busy} />
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Nieuw gesprek beginnen?"
        description="Dit gesprek wordt gewist, ook op je andere apparaten."
        confirmLabel="Wissen"
        destructive
        onConfirm={reset}
      />
    </>
  );
}
```

- [ ] **Step 4: Build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/intel-window.ts src/components/intel-window/chat/ChatEmpty.tsx src/components/intel-window/chat/IntelChat.tsx
git commit -m "feat(intel-chat): E2 empty state with chips and Nieuw gesprek

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: PointCard with mini map, "Toon op kaart" and "Zet als antwoord"

**Files:**
- Create: `src/components/intel-window/chat/MiniMap.tsx`, `src/components/intel-window/chat/PointCard.tsx`
- Modify: `src/lib/intel-window.ts`, `src/components/intel-window/HintPane.tsx`, `src/components/intel-window/chat/ChatMessage.tsx`

**Interfaces:**
- Consumes: `pointCards`, `areaLabel`, `formatDistance`, `sameAnswer` (Task 1); `useHintBoard().solve`/`board` (`src/hooks/hints.hook.ts`); `hasExistingMarker` (`lib/intel-window.ts`); `MapRef.flyTo/markPoint`; `useIntelStore.close`; `materialMapStyle`, `resolveStaticMapStyle`, `useSettingsStore`, `useDarkMode`.
- Produces: `INTEL_CLOSE_MS` in `lib/intel-window.ts`; `PointCard` props `{ point: PointResult | null; proposal?: HintAnswerProposal; mapRef: RefObject<MapRef | null> }`; `MiniMap` props `{ point: LatLng; label: string }`.

- [ ] **Step 1: Share the close delay**

Append to `src/lib/intel-window.ts`:
```ts
/** The intel window's close animation: "Toon op kaart" flies only once the map is in view again */
export const INTEL_CLOSE_MS = 260;
```
In `src/components/intel-window/HintPane.tsx` delete:
```ts
/** The window's close animation: fly only once the map is in view again */
const DIALOG_CLOSE_MS = 260;

```
change `import { type AnswerPreview, DETAIL_PART, answerPreview, hasExistingMarker, initialOpenArea, nextOpenArea } from '@/lib/intel-window';` to:
```ts
import { type AnswerPreview, DETAIL_PART, INTEL_CLOSE_MS, answerPreview, hasExistingMarker, initialOpenArea, nextOpenArea } from '@/lib/intel-window';
```
and replace `DIALOG_CLOSE_MS);` with `INTEL_CLOSE_MS);`.

- [ ] **Step 2: The mini map**

Create `src/components/intel-window/chat/MiniMap.tsx`:
```tsx
import { useRef } from 'react';
import Maplibre, { AttributionControl, Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { AnimatePresence, motion, useInView } from 'motion/react';
import { useDarkMode } from '@/hooks/utils/darkmode.hook';
import { materialMapStyle } from '@/lib/map-style';
import { resolveStaticMapStyle } from '@/lib/map-styles';
import useSettingsStore from '@/stores/settings.store';
import type { LatLng } from '@/types/IntelChat';

/**
 * Non-interactive map in the user's map style at zoom 14 with an orange pin. The WebGL map only exists while the card is
 * near the visible part of the chat (it fades in/out), so a long chat never runs out of WebGL contexts. The worker URL
 * is set by Map.tsx, which IntelDialog already imports.
 */
export default function MiniMap({ point, label }: { point: LatLng; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { margin: '200px 0px' });
  const mapStyle = useSettingsStore((state) => state.mapStyle);
  const dark = useDarkMode();
  const style = mapStyle ? resolveStaticMapStyle(mapStyle) : materialMapStyle(dark);
  return (
    <div ref={ref} className="relative h-24 overflow-hidden bg-beheer-row-high">
      <AnimatePresence>
        {near && (
          <motion.div key="map" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <Maplibre
              initialViewState={{ longitude: point.lng, latitude: point.lat, zoom: 14 }}
              mapStyle={style}
              interactive={false}
              attributionControl={false}
              style={{ width: '100%', height: '100%' }}
              // Credits collapsed to the (i) button, as on phones
              onLoad={(event) => event.target.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')}
            >
              <AttributionControl position="top-right" compact />
              <Marker longitude={point.lng} latitude={point.lat} anchor="center">
                <span className="block size-3 rounded-full bg-primary ring-[6px] ring-primary/30" />
              </Marker>
            </Maplibre>
          </motion.div>
        )}
      </AnimatePresence>
      <span className="pointer-events-none absolute bottom-1.5 left-2 max-w-[70%] truncate rounded-md bg-black/55 px-1.5 py-0.5 text-[10.5px] font-medium text-white">{label}</span>
    </div>
  );
}
```

- [ ] **Step 3: The point card**

Create `src/components/intel-window/chat/PointCard.tsx`:
```tsx
import { type ReactNode, type RefObject, useState } from 'react';
import { CheckIcon, Loader2Icon, MapPinIcon } from 'lucide-react';
import type { LngLat } from 'maplibre-gl';
import { toast } from 'sonner';
import { Pill, Tag } from '@/components/beheer/controls/Pill';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { MapRef } from '@/components/Map';
import { useHintBoard } from '@/hooks/hints.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { areaLabel, formatDistance, sameAnswer } from '@/lib/intel-chat';
import { INTEL_CLOSE_MS, hasExistingMarker } from '@/lib/intel-window';
import useIntelStore from '@/stores/intel.store';
import type { HintAnswerProposal, PointResult } from '@/types/IntelChat';
import MiniMap from './MiniMap';

interface PointCardProps {
  /** showPoint output, or a proposal's point (null for a text answer) */
  point: PointResult | null;
  /** proposeHintAnswer output: adds "Zet als antwoord" */
  proposal?: HintAnswerProposal;
  mapRef: RefObject<MapRef | null>;
}

/** M3 result card: mini map, RD / Deelgebied / Dichtstbij, "Toon op kaart" and (proposals) "Zet als antwoord" */
export default function PointCard({ point, proposal, mapRef }: PointCardProps) {
  const close = useIntelStore((state) => state.close);

  function showOnMap() {
    if (!point) return;
    const { lng, lat } = point.latLng;
    close();
    setTimeout(() => {
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 2000 });
      mapRef.current?.markPoint({ lng, lat } as LngLat);
    }, INTEL_CLOSE_MS);
  }

  return (
    <div className="overflow-hidden rounded-[18px] bg-beheer-row">
      {point && <MiniMap point={point.latLng} label={point.label} />}
      <div className="grid gap-1.5 px-3 py-2.5 text-[12.5px]">
        {proposal && (
          <Row name={`Antwoord ${areaLabel(proposal.area)}`}>
            <span className="truncate font-mono">{proposal.answer}</span>
          </Row>
        )}
        {point ? (
          <>
            <Row name="RD">
              <span className="font-mono tabular-nums">{point.rdText}</span>
            </Row>
            <Row name="Deelgebied">
              {point.area.area ? areaLabel(point.area.area) : 'onbekend'}
              {point.area.area && point.area.method !== 'hull' && <Tag tone="warn">schatting</Tag>}
            </Row>
            <Row name="Dichtstbij">{point.nearestGroup ? <span className="truncate">{`${point.nearestGroup.name} · ${formatDistance(point.nearestGroup.distanceM)}`}</span> : '—'}</Row>
          </>
        ) : (
          proposal && <Row name="Deelgebied">{areaLabel(proposal.area)}</Row>
        )}
        <div className="mt-1 flex flex-wrap gap-1.5">
          {point && (
            <Pill onClick={showOnMap}>
              <MapPinIcon />
              Toon op kaart
            </Pill>
          )}
          {proposal && <SaveAnswerButton proposal={proposal} />}
        </div>
      </div>
    </div>
  );
}

function Row({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-muted-foreground">
      <span className="shrink-0">{name}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-right font-semibold text-foreground">{children}</span>
    </div>
  );
}

/**
 * Posts the proposal through the existing solve endpoint (the AI never writes itself). An area that already has another
 * answer asks to overwrite first; a hint marker already there for that hour asks to move it (409, as in HintPane). Shows
 * "Opgeslagen ✓" once the board holds this answer.
 */
function SaveAnswerButton({ proposal }: { proposal: HintAnswerProposal }) {
  const { board, solve } = useHintBoard({ live: true });
  const cell = board?.cells.find((existing) => existing.articleId === proposal.articleId && existing.area === proposal.area);
  const stored = cell?.status === 'solved' && cell.answer ? cell.answer : null;
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [ask, setAsk] = useState<'overwrite' | 'marker'>('overwrite');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const saved = (stored !== null && sameAnswer(stored, proposal.answer)) || (justSaved && stored === null);
  const label = areaLabel(proposal.area);

  async function save(replaceMarker: boolean) {
    setSaving(true);
    try {
      await solve(proposal.articleId, proposal.area, proposal.answer, replaceMarker);
      setJustSaved(true);
      setConfirmOpen(false);
    } catch (error) {
      if (!replaceMarker && hasExistingMarker(error)) {
        setAsk('marker');
        setConfirmOpen(true);
      } else toast.error(apiErrorMessage(error, 'Antwoord opslaan mislukt'));
    } finally {
      setSaving(false);
    }
  }

  function click() {
    if (saved || saving) return;
    if (stored) {
      setAsk('overwrite');
      setConfirmOpen(true);
    } else void save(false);
  }

  return (
    <>
      <Pill variant={saved ? 'success' : 'primary'} disabled={saving} aria-disabled={saved} onClick={click} morphKey={saved ? 'saved' : saving ? 'saving' : 'idle'}>
        {saved ? (
          <>
            Opgeslagen
            <CheckIcon />
          </>
        ) : saving ? (
          <Loader2Icon className="animate-spin" aria-label="Opslaan…" />
        ) : (
          <>
            <CheckIcon />
            Zet als antwoord
          </>
        )}
      </Pill>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={ask === 'overwrite' ? 'Antwoord vervangen?' : 'Bestaande marker vervangen?'}
        description={
          ask === 'overwrite'
            ? `${label} heeft al ${stored ?? ''} als antwoord. Vervangen door ${proposal.answer}?`
            : `Er staat al een hint-marker voor ${label} op dit uur. Die wordt verplaatst naar dit antwoord.`
        }
        confirmLabel="Vervangen"
        onConfirm={() => save(ask === 'marker')}
      />
    </>
  );
}
```

- [ ] **Step 4: Render point cards in assistant messages**

Replace `src/components/intel-window/chat/ChatMessage.tsx` with:
```tsx
import type { RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { TextUIPart, UIMessage } from 'ai';
import type { MapRef } from '@/components/Map';
import { type ChatPart, pointCards } from '@/lib/intel-chat';
import { POP } from '@/lib/motion';
import ChatMarkdown from './ChatMarkdown';
import PointCard from './PointCard';

interface ChatMessageProps {
  message: UIMessage;
  /** This assistant message is the one streaming now */
  streaming: boolean;
  /** For "Toon op kaart" on point cards */
  mapRef: RefObject<MapRef | null>;
}

const isText = (part: ChatPart): part is TextUIPart => part.type === 'text';

/** User bubble on the right; an assistant message as markdown text, then its point cards (popping in) */
export default function ChatMessage({ message, mapRef }: ChatMessageProps) {
  const texts = message.parts.filter(isText).filter((part) => part.text.trim() !== '');
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[16px_16px_6px_16px] bg-beheer-row-high px-3 py-2 text-[13px] break-words whitespace-pre-wrap">{texts.map((part) => part.text).join('\n')}</div>
      </div>
    );
  }
  const cards = pointCards(message);
  return (
    <div className="mx-1 flex flex-col gap-2">
      {texts.map((part, index) => (
        <ChatMarkdown key={index} text={part.text} />
      ))}
      <AnimatePresence initial={false}>
        {cards.map((card) => (
          <motion.div key={card.id} {...POP} style={{ originY: 0 }}>
            <PointCard point={card.point} proposal={card.proposal} mapRef={mapRef} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 5: Build, lint, tests**

Run: `npm run build && npm run lint && npx --yes bun test`
Expected: all succeed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/intel-window.ts src/components/intel-window/HintPane.tsx src/components/intel-window/chat/MiniMap.tsx src/components/intel-window/chat/PointCard.tsx src/components/intel-window/chat/ChatMessage.tsx
git commit -m "feat(intel-chat): point cards with mini map, Toon op kaart and Zet als antwoord

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

P1 is complete after this task (layout, card, input, messages, point card, proposal save).

---

### Task 6: Image attachment (paperclip, paste, drop)

**Files:**
- Modify: `src/lib/image.ts`, `src/components/intel-window/chat/ChatInput.tsx`, `src/components/intel-window/chat/ChatMessage.tsx`

**Interfaces:**
- Consumes: `chatImageProblem`, `dataUrlBytes`, `CHAT_IMAGE_MAX_SIDE`, `CHAT_IMAGE_QUALITY`, `CHAT_IMAGE_MAX_BYTES` (Task 1); `PromptInputAction` (Task 3).
- Produces: `prepareChatImage(file: Blob, maxSide: number, quality: number): Promise<string>` (JPEG data URL) in `lib/image.ts`; `ChatInput.onSend: (text: string, image?: FileUIPart) => void`.

- [ ] **Step 1: Resize to a data URL**

Append to `src/lib/image.ts`:
```ts
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Afbeelding lezen mislukt'));
    reader.readAsDataURL(blob);
  });
}

/** An AI chat attachment: upright (EXIF), long side at most `maxSide`, JPEG at `quality`, as a data URL */
export async function prepareChatImage(file: Blob, maxSide: number, quality: number): Promise<string> {
  const bitmap = await decodeScaled(file, maxSide);
  try {
    return await blobToDataUrl(await encodeJpeg(bitmap, maxSide, quality));
  } finally {
    bitmap.close();
  }
}
```

- [ ] **Step 2: ChatInput with the image**

Replace `src/components/intel-window/chat/ChatInput.tsx` with:
```tsx
import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { FileUIPart } from 'ai';
import { BrainIcon, GlobeIcon, Loader2Icon, PaperclipIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { prepareChatImage } from '@/lib/image';
import { CHAT_IMAGE_MAX_BYTES, CHAT_IMAGE_MAX_SIDE, CHAT_IMAGE_QUALITY, PLACEHOLDER, chatImageProblem, dataUrlBytes } from '@/lib/intel-chat';
import { POP, REVEAL_TRANSITION } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { IntelKind } from '@/types/Intel';
import { ModeToggle, PromptInput, PromptInputAction, PromptInputActions, PromptInputTextarea, SendButton } from './prompt-input';
import { useChatModes } from './useIntelChat';

interface ChatInputProps {
  kind: IntelKind;
  /** A turn is running: the send button stops it; typing goes on */
  busy: boolean;
  /** History not there yet (or failed): nothing can be sent */
  disabled: boolean;
  onSend: (text: string, image?: FileUIPart) => void;
  onStop: () => void;
}

type ChatImage = { status: 'loading' } | { status: 'ready'; url: string; name: string };

/** T1 prompt box: one image (paperclip, paste while focused, drop), textarea, Web and Denk diep (kept per user), send ↔ stop */
export default function ChatInput({ kind, busy, disabled, onSend, onStop }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [image, setImage] = useState<ChatImage | null>(null);
  const [dragging, setDragging] = useState(false);
  const [modes, setMode] = useChatModes();
  const fileInput = useRef<HTMLInputElement>(null);
  // A newer pick (or ✕) makes a resize that is still running irrelevant
  const attachId = useRef(0);
  const ready = !busy && !disabled && value.trim() !== '' && image?.status !== 'loading';

  async function attach(file: File) {
    const problem = chatImageProblem(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    const id = ++attachId.current;
    setImage({ status: 'loading' });
    try {
      const url = await prepareChatImage(file, CHAT_IMAGE_MAX_SIDE, CHAT_IMAGE_QUALITY);
      if (id !== attachId.current) return;
      if (dataUrlBytes(url) > CHAT_IMAGE_MAX_BYTES) {
        setImage(null);
        toast.error('Afbeelding is te groot, ook na verkleinen');
        return;
      }
      setImage({ status: 'ready', url, name: file.name || 'afbeelding.jpg' });
    } catch {
      if (id !== attachId.current) return;
      setImage(null);
      toast.error('Afbeelding lezen mislukt');
    }
  }

  function clearImage() {
    attachId.current++;
    setImage(null);
  }

  function submit() {
    if (!ready) return;
    const file: FileUIPart | undefined = image?.status === 'ready' ? { type: 'file', mediaType: 'image/jpeg', url: image.url, filename: image.name } : undefined;
    onSend(value.trim(), file);
    setValue('');
    clearImage();
  }

  return (
    <PromptInput
      value={value}
      onValueChange={setValue}
      onSubmit={submit}
      disabled={disabled}
      className={cn(dragging && 'ring-[3px] ring-ring/50')}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        const file = event.dataTransfer.files[0];
        setDragging(false);
        if (!file) return;
        event.preventDefault();
        void attach(file);
      }}
    >
      <AnimatePresence initial={false}>
        {image && (
          <motion.div key="thumb" className="overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={REVEAL_TRANSITION}>
            <div className="px-1.5 pt-1.5 pb-1">
              <motion.div {...POP} className="relative size-14 overflow-hidden rounded-xl bg-beheer-row">
                <AnimatePresence mode="wait" initial={false}>
                  {image.status === 'ready' ? (
                    <motion.img key="image" src={image.url} alt="Bijlage" className="size-full object-cover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
                  ) : (
                    <motion.span key="loading" className="grid size-full place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Loader2Icon className="size-4 animate-spin text-muted-foreground" aria-label="Afbeelding verkleinen…" />
                    </motion.span>
                  )}
                </AnimatePresence>
                <button
                  type="button"
                  aria-label="Afbeelding weghalen"
                  onClick={clearImage}
                  className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-black/60 text-white outline-none focus-visible:ring-2 focus-visible:ring-white [&_svg]:size-3"
                >
                  <XIcon />
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <PromptInputTextarea
        placeholder={PLACEHOLDER[kind]}
        aria-label="Vraag aan de AI"
        maxLength={4000}
        // A draft: Escape clears it instead of leaving the item (keepOpenWhileEditing)
        data-inline-edit={value ? '' : undefined}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.stopPropagation();
            setValue('');
          }
        }}
        // Only while the textarea has focus (no document-wide listener)
        onPaste={(event) => {
          const file = [...event.clipboardData.files].find((candidate) => candidate.type.startsWith('image/'));
          if (!file) return;
          event.preventDefault();
          void attach(file);
        }}
      />
      <PromptInputActions className="pt-0.5">
        <PromptInputAction tooltip="Afbeelding toevoegen">
          <button
            type="button"
            aria-label="Afbeelding toevoegen"
            disabled={disabled}
            onClick={() => fileInput.current?.click()}
            className="grid size-8 place-items-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4"
          >
            <PaperclipIcon />
          </button>
        </PromptInputAction>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void attach(file);
          }}
        />
        <ModeToggle tone="web" on={modes.web} onToggle={(on) => setMode('web', on)} icon={<GlobeIcon />} label="Web" tooltip="Web: mag op internet zoeken" />
        <span aria-hidden className="mx-0.5 h-4 w-px bg-foreground/10" />
        <ModeToggle tone="think" on={modes.deep} onToggle={(on) => setMode('deep', on)} icon={<BrainIcon />} label="Denk diep" tooltip="Denk diep: sterker model, duurt langer" />
        <SendButton state={busy ? 'busy' : ready ? 'ready' : 'idle'} onSend={submit} onStop={onStop} />
      </PromptInputActions>
    </PromptInput>
  );
}
```

- [ ] **Step 3: Show the image in the user bubble**

In `src/components/intel-window/chat/ChatMessage.tsx`:

Change `import type { RefObject } from 'react';` to `import { type RefObject, useState } from 'react';`, change `import type { TextUIPart, UIMessage } from 'ai';` to `import type { FileUIPart, TextUIPart, UIMessage } from 'ai';`, and add `import ImageLightbox from '@/components/ImageLightbox';` after it.

After the `isText` line add:
```tsx
const isImage = (part: ChatPart): part is FileUIPart => part.type === 'file' && part.mediaType.startsWith('image');
```

Replace:
```tsx
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[16px_16px_6px_16px] bg-beheer-row-high px-3 py-2 text-[13px] break-words whitespace-pre-wrap">{texts.map((part) => part.text).join('\n')}</div>
      </div>
    );
  }
```
with:
```tsx
  if (message.role === 'user') return <UserMessage message={message} text={texts.map((part) => part.text).join('\n')} />;
```

and add at the end of the file:
```tsx
/** The user's question (right), with its image above it (click: lightbox) */
function UserMessage({ message, text }: { message: UIMessage; text: string }) {
  const image = message.parts.find(isImage);
  const [zoom, setZoom] = useState(false);
  return (
    <div className="flex flex-col items-end gap-1.5">
      {image && (
        <>
          <button type="button" aria-label="Afbeelding vergroten" onClick={() => setZoom(true)} className="cursor-zoom-in overflow-hidden rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <img src={image.url} alt="" className="max-h-40 max-w-[220px] object-cover" />
          </button>
          <ImageLightbox src={image.url} alt="" open={zoom} onOpenChange={setZoom} />
        </>
      )}
      {text && <div className="max-w-[85%] rounded-[16px_16px_6px_16px] bg-beheer-row-high px-3 py-2 text-[13px] break-words whitespace-pre-wrap">{text}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Build, lint, tests**

Run: `npm run build && npm run lint && npx --yes bun test`
Expected: all succeed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/image.ts src/components/intel-window/chat/ChatInput.tsx src/components/intel-window/chat/ChatMessage.tsx
git commit -m "feat(intel-chat): attach one image (paperclip, paste, drop), resized client-side

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: ToolsUsed (expandable) and web source chips

**Files:**
- Create: `src/components/intel-window/chat/ToolsUsed.tsx`, `src/components/intel-window/chat/SourceChips.tsx`
- Modify: `src/components/intel-window/chat/ChatMessage.tsx`

**Interfaces:**
- Consumes: `toolCalls`, `toolSummary`, `toolDoneLabel`, `toolTone`, `stackedTools`, `webSources`, `ChatToolCall`, `ChatSource` (Task 1).
- Produces: `ToolsUsed` props `{ calls: ChatToolCall[] }`; `ToolIcon` props `{ name: string; big?: boolean; className?: string }`; `SourceChips` props `{ sources: ChatSource[] }`.

- [ ] **Step 1: ToolsUsed**

Create `src/components/intel-window/chat/ToolsUsed.tsx`:
```tsx
import { useState } from 'react';
import { motion } from 'motion/react';
import { CalculatorIcon, ChevronRightIcon, FileTextIcon, GlobeIcon, MapPinIcon, type LucideIcon } from 'lucide-react';
import Reveal from '@/components/motion/Reveal';
import { type ChatToolCall, stackedTools, toolDoneLabel, toolSummary, toolTone } from '@/lib/intel-chat';
import { SWAP_TRANSITION } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { ToolTone } from '@/types/IntelChat';

const TONE_CLASS: Record<ToolTone, string> = {
  app: 'bg-fox-warn-container text-fox-on-warn',
  map: 'bg-fox-ok-container text-fox-on-ok',
  web: 'bg-fox-cooldown-container text-fox-on-cooldown',
  think: 'bg-ai-think-container text-ai-on-think',
};
const TONE_ICON: Record<ToolTone, LucideIcon> = { app: FileTextIcon, map: MapPinIcon, web: GlobeIcon, think: CalculatorIcon };

/** Tonal square with the tool group's icon */
export function ToolIcon({ name, big = false, className }: { name: string; big?: boolean; className?: string }) {
  const tone = toolTone(name);
  const Icon = TONE_ICON[tone];
  return (
    <span aria-hidden className={cn('grid shrink-0 place-items-center', big ? 'size-6 rounded-lg [&_svg]:size-3.5' : 'size-4 rounded-md [&_svg]:size-2.5', TONE_CLASS[tone], className)}>
      <Icon />
    </span>
  );
}

/** After a turn: "N tools gebruikt ›" with up to 3 stacked icons; click unfolds a list (label + result line, red dot on errors) */
export default function ToolsUsed({ calls }: { calls: ChatToolCall[] }) {
  const [open, setOpen] = useState(false);
  const failed = calls.some((call) => call.state === 'error');
  return (
    <div className="flex flex-col items-start">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-[10px] bg-beheer-row px-2 py-1 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="flex pr-1">
          {stackedTools(calls).map((name) => (
            <ToolIcon key={name} name={name} className="-mr-1 ring-2 ring-beheer-row" />
          ))}
        </span>
        {calls.length} {calls.length === 1 ? 'tool' : 'tools'} gebruikt
        {failed && <span className="size-1.5 rounded-full bg-destructive" aria-label="met fouten" />}
        <motion.span className="grid" animate={{ rotate: open ? 90 : 0 }} transition={SWAP_TRANSITION}>
          <ChevronRightIcon className="size-3.5" />
        </motion.span>
      </button>
      <div className="w-full">
        <Reveal>
          {open && (
            <ul className="flex flex-col gap-0.5 pt-1.5">
              {calls.map((call) => {
                const summary = toolSummary(call);
                return (
                  <li key={call.id} className="flex min-w-0 items-center gap-2 rounded-xl bg-beheer-row px-2 py-1.5 text-[12px]">
                    <ToolIcon name={call.name} big />
                    <span className="shrink-0 font-semibold">{toolDoneLabel(call.name)}</span>
                    {summary && (
                      <span className={cn('flex min-w-0 items-center gap-1.5', call.state === 'error' ? 'text-destructive dark:text-red-300' : 'text-muted-foreground')}>
                        {call.state === 'error' && <span className="size-1.5 shrink-0 rounded-full bg-destructive" aria-hidden />}
                        <span className="truncate">{summary}</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Reveal>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: SourceChips**

Create `src/components/intel-window/chat/SourceChips.tsx`:
```tsx
import { AnimatePresence, motion } from 'motion/react';
import type { ChatSource } from '@/lib/intel-chat';
import { POP } from '@/lib/motion';

/** Web sources of the answer as cooldown-blue chips; open in a new tab */
export default function SourceChips({ sources }: { sources: ChatSource[] }) {
  return (
    <div className="relative flex flex-wrap gap-1.5">
      <AnimatePresence initial={false} mode="popLayout">
        {sources.map((source) => (
          <motion.a
            key={source.url}
            layout
            {...POP}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            title={source.url}
            className="max-w-[220px] truncate rounded-lg bg-fox-cooldown-container px-2 py-0.5 text-[11.5px] font-medium text-fox-on-cooldown outline-none hover:brightness-110 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {source.title}
          </motion.a>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 3: Wire into assistant messages**

In `src/components/intel-window/chat/ChatMessage.tsx`:

Add imports:
```tsx
import Reveal from '@/components/motion/Reveal';
import SourceChips from './SourceChips';
import ToolsUsed from './ToolsUsed';
```
and change `import { type ChatPart, pointCards } from '@/lib/intel-chat';` to:
```tsx
import { type ChatPart, pointCards, toolCalls, webSources } from '@/lib/intel-chat';
```

Change the component signature `export default function ChatMessage({ message, mapRef }: ChatMessageProps) {` to:
```tsx
export default function ChatMessage({ message, streaming, mapRef }: ChatMessageProps) {
```
and its doc comment to `/** User bubble on the right; an assistant message: tools used (after the turn), markdown text, web sources, point cards */`.

Replace the assistant branch's return (from `  const cards = pointCards(message);` to the end of `ChatMessage`):
```tsx
  const cards = pointCards(message);
  return (
    <div className="mx-1 flex flex-col gap-2">
      {texts.map((part, index) => (
        <ChatMarkdown key={index} text={part.text} />
      ))}
      <AnimatePresence initial={false}>
        {cards.map((card) => (
          <motion.div key={card.id} {...POP} style={{ originY: 0 }}>
            <PointCard point={card.point} proposal={card.proposal} mapRef={mapRef} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```
with:
```tsx
  const cards = pointCards(message);
  const calls = toolCalls(message);
  const sources = webSources(message);
  return (
    <div className="mx-1 flex flex-col">
      {/* While it runs the status line shows the tools; the stack unfolds above the answer once the turn is done
          (outside the gap container, so folding in never jumps by a gap) */}
      <Reveal>
        {!streaming && calls.length > 0 && (
          <div className="pb-2">
            <ToolsUsed calls={calls} />
          </div>
        )}
      </Reveal>
      <div className="flex flex-col gap-2">
        {texts.map((part, index) => (
          <ChatMarkdown key={index} text={part.text} />
        ))}
        {sources.length > 0 && <SourceChips sources={sources} />}
        <AnimatePresence initial={false}>
          {cards.map((card) => (
            <motion.div key={card.id} {...POP} style={{ originY: 0 }}>
              <PointCard point={card.point} proposal={card.proposal} mapRef={mapRef} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build, lint, tests**

Run: `npm run build && npm run lint && npx --yes bun test`
Expected: all succeed.

- [ ] **Step 5: Commit**

```bash
git add src/components/intel-window/chat/ToolsUsed.tsx src/components/intel-window/chat/SourceChips.tsx src/components/intel-window/chat/ChatMessage.tsx
git commit -m "feat(intel-chat): tools-used stack with expandable list and web source chips

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Motion polish (✦ spin, entrance stagger, shimmer, reduced motion)

**Files:**
- Modify: `src/index.css`, `src/lib/intel-window.ts`, `src/components/intel-window/chat/IntelChat.tsx`, `src/components/intel-window/chat/ToolStatus.tsx`, `src/components/intel-window/IntelDialog.tsx`

**Interfaces:**
- Consumes: `CHAT_EMPTY` custom delay (Task 4).
- Produces: `CHAT_SPARK`, `CHAT_EMPTY_ENTRANCE_DELAY` in `lib/intel-window.ts`; `IntelChat` prop `entrance: boolean`; CSS class `.ai-shimmer`.

- [ ] **Step 1: Shimmer CSS (off with reduced motion)**

Append to `src/index.css`:
```css
/* Intel AI chat: the running tool's label glints (M3 status line); plain muted text with reduced motion */
.ai-shimmer {
  background: linear-gradient(90deg, var(--muted-foreground) 30%, var(--foreground) 50%, var(--muted-foreground) 70%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: ai-shimmer 1.4s linear infinite;
}

@keyframes ai-shimmer {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -100% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ai-shimmer {
    animation: none;
    background: none;
    color: var(--muted-foreground);
  }
}
```

In `src/components/intel-window/chat/ToolStatus.tsx` replace `className="inline-block text-muted-foreground"` with `className="ai-shimmer inline-block"`.

- [ ] **Step 2: Presets**

Append to `src/lib/intel-window.ts`:
```ts
/** The ✦ in the chat header spins in once the card has slid in (open from the timeline) */
export const CHAT_SPARK = {
  initial: { rotate: -120, scale: 0.4, opacity: 0 },
  animate: { rotate: 0, scale: 1, opacity: 1 },
  transition: { type: 'spring', stiffness: 260, damping: 14, delay: 0.5 },
} satisfies { initial: TargetAndTransition; animate: TargetAndTransition; transition: Transition };

/** The empty state's parts start after the card's slide and the ✦ (open from the timeline) */
export const CHAT_EMPTY_ENTRANCE_DELAY = 0.7;
```

- [ ] **Step 3: Entrance in the card**

In `src/components/intel-window/chat/IntelChat.tsx`:

Change `import { CHAT_MESSAGE } from '@/lib/intel-window';` to:
```tsx
import { CHAT_EMPTY_ENTRANCE_DELAY, CHAT_MESSAGE, CHAT_SPARK } from '@/lib/intel-window';
```

Replace the `IntelChatProps` interface with:
```tsx
interface IntelChatProps {
  item: IntelItem;
  /** For "Toon op kaart" on point cards */
  mapRef: RefObject<MapRef | null>;
  /** Opened from the timeline: the ✦ spins in and the empty state staggers in after the card's slide (first item only) */
  entrance: boolean;
}
```

Replace the `IntelChat` function with:
```tsx
/** The AI chat card right of the open item (layout B). Its content swaps (fades) when another item opens; each item has its own conversation. */
export default function IntelChat({ item, mapRef, entrance }: IntelChatProps) {
  const [firstId] = useState(item.id);
  return (
    <section aria-label="Vraag de AI" className="flex min-h-0 flex-1 flex-col rounded-[24px] bg-card p-3.5">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={item.id} {...FADE} className="flex min-h-0 flex-1 flex-col gap-2.5">
          <ChatPanel item={item} mapRef={mapRef} entrance={entrance && item.id === firstId} />
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
```

In `ChatPanel`: change `function ChatPanel({ item, mapRef }: IntelChatProps) {` to `function ChatPanel({ item, mapRef, entrance }: IntelChatProps) {`; change `        kind={item.kind}` (the `ChatHeader` prop line) to:
```tsx
        kind={item.kind}
        entrance={entrance}
```
and change `<ChatEmpty item={item} disabled={busy || chat.unavailable} onPick={chat.send} />` to:
```tsx
<ChatEmpty item={item} disabled={busy || chat.unavailable} onPick={chat.send} delay={entrance ? CHAT_EMPTY_ENTRANCE_DELAY : 0} />
```

Replace the `ChatHeader` function's first lines:
```tsx
function ChatHeader({ kind, action }: { kind: IntelKind; action?: ReactNode }) {
  return (
    <div className="mx-1 flex items-center gap-2">
      <span aria-hidden className="text-base leading-none text-fox-warn">
        ✦
      </span>
```
with:
```tsx
function ChatHeader({ kind, entrance, action }: { kind: IntelKind; entrance: boolean; action?: ReactNode }) {
  return (
    <div className="mx-1 flex items-center gap-2">
      <motion.span aria-hidden className="inline-block text-base leading-none text-fox-warn" {...(entrance ? CHAT_SPARK : {})}>
        ✦
      </motion.span>
```

- [ ] **Step 4: Pass the entrance from the detail view**

In `src/components/intel-window/IntelDialog.tsx` replace `<IntelChat item={item} mapRef={mapRef} />` with:
```tsx
<IntelChat item={item} mapRef={mapRef} entrance={!skip} />
```

- [ ] **Step 5: Build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 6: Compare with the mockup**

Open `empty-state.html` (E2, "▶ Afspelen") next to the app; open a hint from the timeline. Expected: header morph → left parts rise → card slides in (0.28 s) → ✦ spins in (~0.5 s) → ✦ block, title, line, chips stagger 70 ms apart. In the OS with "reduce motion" on: no slide/spin (MotionConfig), the status text is plain muted (no glint).

- [ ] **Step 7: Commit**

```bash
git add src/index.css src/lib/intel-window.ts src/components/intel-window/chat/IntelChat.tsx src/components/intel-window/chat/ToolStatus.tsx src/components/intel-window/IntelDialog.tsx
git commit -m "feat(intel-chat): spark spin, empty-state entrance and status shimmer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Verification and manual end to end

Needs the server's `feat/intel-ai-chat` branch (its plan implements the contract) and a real `GEMINI_API_KEY` in `/home/silke/Documents/Jotihunt 2026/.env`. Never touch the docker stack (live instance); use a throwaway DB and port.

- [ ] **Step 1: Full checks**

```bash
cd "/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client"
npx --yes bun test && npm run lint && npm run build
```
Expected: all green.

- [ ] **Step 2: Throwaway server with Gemini**

```bash
ROOT="/home/silke/Documents/Jotihunt 2026"
git -C "$ROOT/jotihunt-tracker-server" branch --show-current   # must print feat/intel-ai-chat
cd "$ROOT/jotihunt-tracker-server"
JWT=$(grep '^JWT_SECRET=' "$ROOT/.env" | cut -d= -f2-)
GEMINI=$(grep '^GEMINI_API_KEY=' "$ROOT/.env" | cut -d= -f2-)
env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Amsterdam \
  PORT=3105 MONGO_URI="mongodb://localhost:27017/jotihunt-chat-smoke" JWT_SECRET="$JWT" GEMINI_API_KEY="$GEMINI" \
  JOTIHUNT_API_URL=http://127.0.0.1:9 TRACCAR_API_URL=http://127.0.0.1:9 TRACCAR_API_TOKEN=x \
  HOME_TEAM_API_ID=1 WEBAUTHN_RP_ID=localhost WEBAUTHN_ORIGINS=http://localhost:5180 PUBLIC_APP_URL=http://localhost:5180 JOTIHUNT_WEB_URL=http://127.0.0.1:9 UPLOADS_DIR="$ROOT/.stress/uploads-3105" \
  nohup npx --yes bun run src/index.ts > "$ROOT/.stress/server-3105.log" 2>&1 &
echo "server pid $!"
MONGO_URI="mongodb://localhost:27017/jotihunt-chat-smoke" npx --yes bun run src/scripts/seed-hint.ts
MONGO_URI="mongodb://localhost:27017/jotihunt-chat-smoke" PUBLIC_APP_URL=http://localhost:5180 npx --yes bun run src/scripts/login-link.ts --new Tester --admin
```
Expected: the last command prints a login link on `http://localhost:5180`.

- [ ] **Step 3: Client against it**

```bash
cd "/home/silke/Documents/Jotihunt 2026/jotihunt-tracker-client"
API_BASE_URL=http://localhost:3105 npm run dev -- --port 5180 --strictPort
```
Open the login link, then Intel → the seeded "Testhint".

- [ ] **Step 4: Walk the flows (each must animate, nothing pops)**

1. Empty state: chips "Los Alpha op" … + "Check antwoorden"; the input is enabled.
2. Click "Los Charlie op": user bubble rises in, the status line glints through tool labels ("Item lezen…", "Coördinaten omzetten…", "Punt checken…"), then the answer streams; after the turn "N tools gebruikt ›" unfolds above it; click: the list expands with summaries; a PointCard pops in with mini map, RD, Deelgebied (+ "schatting" unless hull), Dichtstbij.
3. "Toon op kaart": the window closes, the map flies to the point and the picked-location popup marks it.
4. Re-open; "Zet als antwoord": becomes "Opgeslagen ✓"; the left HintPane row for that area shows the answer (cookie pops). Ask for the same area again with a different answer → "Antwoord vervangen?" confirm.
5. Web on: "Zoek op internet wat …" → "Zoeken op internet…", source chips (open in a new tab). Web off: the AI says it can't search (server hides web tools).
6. Denk diep on: still answers (slower). Toggles survive a reload.
7. Paste a screenshot into the textarea (only while focused), drop an image, pick one via the paperclip: thumb with spinner → image; ✕ removes it; a > 10 MB file → toast; the sent bubble shows the image (click → lightbox).
8. Stop: during a long answer the send button is a stop square; click → stream stops, partial answer stays.
9. Reload the page and re-open the hint: the conversation is still there. Open another item: its own (empty) chat fades in; switching while streaming stops the stream.
10. "Nieuw gesprek" → confirm → thread fades out, empty state rises in; reload: still empty.
11. Errors: stop the server (`kill <server pid>`) and send → "Er ging iets mis" + "Opnieuw"; restart the server, "Opnieuw" → answer. Send 31 messages within 10 min (or temporarily lower the server limit) → toast "Even rustig aan: te veel vragen, probeer het zo weer". Restart the server without `GEMINI_API_KEY` → "AI is niet ingesteld" replaces the input.
12. Escape: with a draft in the textarea Escape clears it; with an empty textarea Escape goes back to the timeline.

- [ ] **Step 5: Clean up**

```bash
kill <server pid>   # by PID, never pkill -f
mongosh --quiet mongodb://localhost:27017/jotihunt-chat-smoke --eval 'db.dropDatabase()' || docker exec jotihunt-mongodb-1 mongosh --quiet jotihunt-chat-smoke --eval 'db.dropDatabase()'
```

- [ ] **Step 6: Commit any fixes from the walk-through** (one commit per fix, message ending with the Co-Authored-By line). Do not deploy, do not push unless asked.

---

## Contract notes and spec decisions (for the implementer and the server side)

- **Retry ("Opnieuw") resends the same user message id.** `regenerate()` drops the partial assistant message and POSTs the last user message again. If the server already stored that user message (it saves on finish, also after an abort), appending it again would duplicate it. The server must treat a POST whose `message.id` is already in the stored history as "replace from that message on" (truncate the history to before it, then append). Flagged to the server plan.
- **`nearbyGroups` output shape is not in the contract.** The summary accepts either an array or `{ groups: [...] }`; `searchIntel` is read as `{ results: [...] }` (as the contract's summary implies).
- **Tokens:** the spec's `bg-fox-warn-container` / `bg-fox-cooldown-container` classes did not exist (only `--color-fox-on-*`); Task 2 adds `--color-fox-{ok,warn,cooldown,error}-container` and the `--ai-think-*` pair (light `#f2daff` / `#2c0051`, dark `#4f2a75` / `#f0dbff`).
- **Context chip copy:** "ziet deze hint" / "ziet deze opdracht" / "ziet dit bericht" (the spec's list shares the "ziet" prefix).
- **Defaults:** Web on, Denk diep off (spec leaves it open; the mockups show Web on). Stored per user id under localStorage key `intel-chat-modes`.
- **Toggle animation:** icon rotate 360° + scale **1.08** (spec; the original component had 1.1), spring stiffness 260 / damping 25; label width 0 → auto, opacity 0.2 s.
- **"Toon op kaart"** does `flyTo` (zoom 15) + `markPoint` after the window's close animation (`INTEL_CLOSE_MS`, now shared with HintPane, whose own button only flies).
- **Revalidating the board after "Zet als antwoord"**: `useHintBoard().solve` writes the returned cell straight into the SWR cache (same as HintPane), and the intel window polls the board live.
- **Status line:** besides tool labels it shows "Even denken…" before the first token, between steps and while the model reasons (reasoning parts are not rendered).
- **Sending is disabled while the history loads** (otherwise a quick question would hide the stored conversation until the next mount).
- **Mini maps** mount only near the viewport (`useInView`, 200 px margin) to stay under the browser's WebGL context limit in long chats; they use the user's static map style (satellite falls back to the raster-only aerial style).
