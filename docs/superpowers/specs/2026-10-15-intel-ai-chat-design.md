# Intel AI chat — design

Date: 2026-10-15. Picked in the visual companion (mockups in
`.superpowers/brainstorm/1805043-1792055778/content/`): `layout.html` **B**, `promptbox-v2.html` **T1**,
`messages.html` **M3**, `empty-state.html` **E2**.

## Goal

An open item in the Intel window (hint, opdracht, nieuws) gets an AI chat on its right. The user asks the AI to solve
a hint, explain an opdracht or check a point; the AI uses many tools (app data, map/geo, web, code) and answers with
rich result cards. The hunt starts 2026-10-17, so a **priority-1 cut** is marked below; ship P1 first if time is short.

## Scope decisions

- **Desktop only**, like the Intel window itself.
- **Conversations: per user, per item, saved on the server.** Survive reload and other laptops; private. "Nieuw
  gesprek" clears it.
- **The AI never writes.** All tools are read-only or *proposals*: a proposal renders a card with a button
  ("Zet als antwoord"); only the user's click changes data, through the existing endpoints.
- **Prompt box modes:** `Web` (enables the web tools) and `Denk diep` (stronger model + high thinking). No "Kaart"
  mode, no microphone. Paperclip for one image (paste / drop / pick).
- Everyone with an account can use it (no admin gate).

## Architecture

Server agent (approach A): Express route runs `streamText` (ai 7.0.x, `@ai-sdk/google`) with our own tools and pipes
the UI message stream to the response (`pipeUIMessageStreamToResponse`). The client uses `useChat` from
`@ai-sdk/react` with a transport that adds the Bearer token and sends only the newest message.

Gemini built-in tools are **not** mixed with function tools in the main call. `webSearch` and `runCode` are our own
tools whose `execute` does a small `generateText` sub-call with `google.tools.googleSearch` /
`google.tools.codeExecution` and returns plain text + sources.

## Server (`jotihunt-tracker-server`)

### Routes — `src/routes/intel-chat.route.ts`, mounted at `/intel-chat`

All behind `verifyToken`; POST also behind a per-user limit (30 messages / 10 min → 429 `{ error: 'rate_limited' }`).

| Route | Does |
| --- | --- |
| `GET /intel-chat/:articleId` | `{ messages: UIMessage[] }` (empty array when none) |
| `POST /intel-chat/:articleId` | body `{ message: UIMessage, web: boolean, deep: boolean }`; loads history, appends, streams the answer, saves on finish |
| `DELETE /intel-chat/:articleId` | clears the conversation |

404 when the article doesn't exist (or is a hidden test article for a non-demo user, `publicArticlesFilter`).
503 `{ error: 'ai_unavailable' }` when `createModels()` returns null (no `GEMINI_API_KEY`).

### Model — `src/models/intel-chat.model.ts`

`IntelChat { userId, articleId, messages: UIMessage[] (Mixed), updatedAt }`, unique index `(userId, articleId)`.
Saved in the stream's `onFinish` (also after an abort: keep what was produced). History sent to the model is the last
40 messages.

### Agent — `src/services/intel-chat/`

- `agent.ts`: builds the `streamText` call. Model `models('chat')` normally; `deep` → `models('prediction')` (pro) with
  `providerOptions.google.thinkingConfig` high. `stopWhen: isStepCount(12)`. `activeTools` drops `webSearch` and
  `readWebPage` when `web` is false.
- `prompt.ts`: Dutch system prompt: Jotihunt rules in short (from `docs/02`, `docs/04`: deelgebieden, vossen, hunts,
  hint formats, RD coordinates), now (Europe/Amsterdam), the open item (title, kind, summary, plain text, per-area hint
  cells with status/answer). Rules: answer short and in Dutch; say when something is an estimate; never claim to have
  saved anything; for a candidate point always call `checkPoint` and end with `showPoint` / `proposeHintAnswer`.
- Item images (first user turn only): same rules as summaries (≤20, 5 MB each, 14 MB total, https jotihunt.net/.nl
  only, text-only fallback); reuse the summary image loader.
- User image: the client sends it as a file part (already resized, see client); server rejects > 2 MB or non-image.

### Tools — `src/services/intel-chat/tools/` (one file per group, `tool()` + `jsonSchema`)

P1 = priority-1 cut.

**App data**
1. `getItem({ articleId? })` **P1** — item text (htmlToText), summary, image URLs, hint cells. Default: current item.
2. `searchIntel({ query, kind? })` **P1** — case-insensitive search over public articles' title+text; top 10 with
   snippets.
3. `getHintBoard({ area? })` **P1** — all hint cells (article title, slot time, status, answer, location).
4. `getAreas()` **P1** — every area with status (green/orange/red) and huntbaar (setting `huntable-areas` + home team area, same rule as the client's Vossen card) and our own fox team.
5. `getFoxHistory({ area })` — hunts, hunt reports, solved hint points (time-ordered) and latest prediction.
6. `getOurTeams()` — Traccar device positions + Life360 members (name, position, age of fix).

**Map / geo** (`src/services/intel-chat/geo.ts`, pure functions, unit-tested)
7. `convertCoordinates({ input })` **P1** — accepts RD ("152341 431112", "152.341/431.112"), decimal lat/lng,
   degrees-minutes(-seconds); returns `{ rd, latLng, formatted }` or `{ error }`. Reuses `rd-answer.ts`.
8. `checkPoint({ point, area? })` **P1** — area estimate (see below), 5 nearest groups with distance, inside NL,
   distance to the other hint points of that area, nearest of our trackers.
9. `nearbyGroups({ point, radiusM })` **P1** — groups within radius, sorted.
10. `distance({ from, to, walking? })` — metres, bearing, optional walking time (ORS client).
11. `projectPoint({ from, bearingDeg, distanceM })` — destination point (turf).
12. `geocode({ query })` / `reverseGeocode({ point })` — PDOK Locatieserver v3_1 (`free` / `reverse`), NL only.

Area estimate: groups with an `area` → per area a convex hull (turf) buffered 1 km; point inside exactly one → that
area (`method: 'hull'`). Otherwise the nearest group's area (`method: 'nearest-group'`). No group has an area →
`area: null`. The result always carries `method`; the prompt makes the AI call it an estimate unless `hull`.

**Web** (only with `Web` on)
13. `webSearch({ query })` **P1** — sub-call with `google.tools.googleSearch`; returns answer text + sources
    `{ title, url }[]` (from grounding metadata).
14. `readWebPage({ url })` — http(s) only; DNS-resolve and refuse private/loopback/link-local addresses (SSRF guard);
    10 s timeout, 1 MB cap, htmlToText, truncated to 20 000 chars.

**Puzzle**
15. `runCode({ task })` — sub-call with `google.tools.codeExecution`; returns the final output (ciphers, counting,
    arithmetic).

**Proposals** (no side effects; the client renders them as cards)
16. `showPoint({ point, label })` **P1** — returns the point enriched like `checkPoint` (rd, latLng, area, nearest
    group).
17. `proposeHintAnswer({ area, answer })` **P1** — validates via the same parser as `GET /hints/parse-answer`, returns
    `{ area, answer, kind, rd?, latLng?, areaCheck, nearestGroup }`.

Tool errors are returned to the model as `{ error: string }` (never thrown into the stream).

## Client (`jotihunt-tracker-client`)

### Layout (B)

`DetailView` becomes two columns inside the 1160 px window: left the existing item column (`flex-[1.25]`, scrolls on
its own, keeps the "Tijdlijn" pill and morphing header), right `IntelChat` (`flex-1`, full height, `bg-card`,
`rounded-[24px]`, `p-3.5`). The `max-w-[760px]` / `max-w-[960px]` widths go; opdracht status + notes stack when the
column gets narrow (`@container`).

### Components — `src/components/intel-window/chat/`

- `IntelChat.tsx` — card: header "✦ Vraag de AI", context chip ("ziet deze hint" / "deze opdracht" / "dit bericht"),
  "Nieuw gesprek" icon button (confirms via the existing ConfirmDialog pattern when the chat is not empty); message
  list (auto-scroll to bottom while streaming unless the user scrolled up); `ChatInput`.
- `useIntelChat.ts` — `useChat({ id: 'intel-' + articleId, transport })`; loads history with `useAuthSWR('/intel-chat/:id')`
  into `setMessages`; `DefaultChatTransport` with `prepareSendMessagesRequest` → `{ message: last, web, deep }` and the
  auth header; `api` from the axios base URL.
- `ChatEmpty.tsx` (E2) — centred tonal ✦ block (`bg-fox-warn-container text-fox-on-warn`, 54 px, 18 px corners), "Samen
  puzzelen", one line ("Ik ken dit item, de kaart, groepen en vossen, en kan op internet zoeken."), chips by kind:
  hint → "Los {Area} op" per open area (max 3) + "Check antwoorden"; opdracht → "Wat moeten we inleveren?",
  "Ideeën?"; nieuws → "Wat betekent dit voor ons?". Chip click sends it.
- `ChatInput.tsx` (T1) — `bg-beheer-row-high rounded-[20px] p-1.5`, focus `ring-[3px] ring-ring/50`; autosizing
  textarea (max 160 px; Enter sends, Shift+Enter newline); row: paperclip, `Web` toggle (on = `bg-fox-cooldown-container
  text-fox-on-cooldown`), 1 px divider, `Denk diep` toggle (on = purple tonal pair, new tokens `--ai-think-container`
  `#4f2a75` / `--ai-on-think-container` `#f0dbff`, light-theme equivalents), send button `rounded-xl`: idle muted arrow,
  ready `bg-primary`, streaming = stop square (calls `stop()`). Toggles persist per user in localStorage. Image: one
  file, preview thumb with ✕, resized client-side to max 1600 px JPEG q0.85 before sending; > 10 MB original refused
  with a toast. Paste listener only while the textarea is focused (not document-wide).
- `ChatMessage.tsx` — user bubble (`bg-beheer-row-high`, `rounded-[16px_16px_6px_16px]`, right); assistant text
  rendered as markdown (`react-markdown`, no raw HTML).
- `ToolStatus.tsx` (M3) — while a tool part is running: spinner + shimmer text with the tool's Dutch label
  ("Hint lezen…", "Zoeken op internet…", "Punt checken…"); text swaps with `AnimatePresence mode="popLayout"`.
- `ToolsUsed.tsx` — after the turn: "N tools gebruikt ›" with up to 3 tonal tool icons stacked; click expands a list
  (label + short result line per tool), height animates.
- `PointCard.tsx` — for `showPoint` / `proposeHintAnswer` results: non-interactive mini map (small MapLibre instance,
  same style, pin at the point, zoom 14), rows RD / Deelgebied (+ "schatting" when not hull) / Dichtstbij; buttons
  "Toon op kaart" (close dialog, `flyTo` + `markPoint`, same as `HintPane.showOnMap`) and, for proposals,
  "Zet als antwoord" (`POST /hints/:articleId/:area/solve`, then revalidate the board; the button becomes "Opgeslagen ✓";
  an area that already has an answer asks to overwrite first).
- `SourceChips.tsx` — web sources as `bg-fox-cooldown-container` chips (open in a new tab).

### Animations (motion/react, shared presets in `lib/intel-window.ts`)

- Open: after the left parts' stagger the chat card slides in (`x: 26 → 0`, `opacity`, delay 0.28 s, `EASE_OUT`),
  the ✦ spins in (`rotate -120 → 0`, `scale .4 → 1`, spring), empty-state parts stagger 70 ms. Back to the timeline:
  the chat card fades out with the detail.
- Messages rise in (`y: 8 → 0`); streaming text is not animated per token.
- Tool status text swaps; ToolsUsed expands/collapses height; PointCard pops in (`POP`).
- Toggles: icon rotates 360° + scale 1.08 (spring), label width 0 → auto; send icon swaps (mic gone: arrow ↔ stop).
- "Nieuw gesprek": messages fade out, empty state rises in.
- Reduced motion handled by the app-wide `MotionConfig reducedMotion="user"`; the shimmer CSS animation is disabled
  under `prefers-reduced-motion`.

## Errors

- 503 `ai_unavailable` → card shows "AI is niet ingesteld" instead of the input.
- Stream/network error → error row under the last message ("Er ging iets mis") with "Opnieuw" (`regenerate()`).
- 429 → toast "Even rustig aan: te veel vragen, probeer het zo weer".
- Tool `{ error }` results show in ToolsUsed with a red dot; the AI explains in text.
- Switching item while streaming: the stream is stopped (`stop()` on unmount); the server saves what was produced.

## Testing

- Server (`npx --yes bun test`): `geo.ts` (convert formats, hull/nearest-group area, checkPoint, projectPoint),
  SSRF guard (private IPs, non-http schemes, redirects to private hosts), PDOK client with a fake fetch, route tests
  with the fake Gemini from `src/test/ai.ts` (history saved, 404, 503, 429, web off hides web tools).
- Client: `tsc -b`, lint; manual E2E against a throwaway server (`.stress/start-server.sh`) with a real Gemini key:
  solve a sample hint, web search, propose + save an answer, reload keeps the chat.

## New dependencies

- Server: none (`ai`, `@ai-sdk/google`, turf, proj4 are there).
- Client: `ai`, `@ai-sdk/react`, `react-markdown`.

## Out of scope

Shared/team conversations, the AI writing data itself, voice input, mobile, chat outside the Intel window.
