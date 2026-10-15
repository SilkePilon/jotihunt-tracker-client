# Intel AI chat — server/client contract

Companion to `2026-10-15-intel-ai-chat-design.md`. Both plans implement exactly these names and shapes.

## HTTP

All routes: `Authorization: Bearer <token>` (same as every other route), JSON.

- `GET /intel-chat/:articleId` → `200 { messages: IntelChatMessage[] }` (empty array when no chat).
- `POST /intel-chat/:articleId` body `{ message: IntelChatMessage, web: boolean, deep: boolean }` → `200` AI SDK
  UI message stream (SSE, `x-vercel-ai-ui-message-stream: v1`), produced by `pipeUIMessageStreamToResponse`.
  The server prepends the stored history; the client sends only the newest user message.
  The stream's `originalMessages` = stored history + new message, so message ids stay stable.
- `DELETE /intel-chat/:articleId` → `204`.
- Errors (JSON, not streamed): `400 { error: 'invalid_message' }`, `404 { error: 'not_found' }`,
  `429 { error: 'rate_limited' }` (30 POSTs / 10 min / user), `503 { error: 'ai_unavailable' }`.

`IntelChatMessage` = AI SDK `UIMessage` (`{ id, role: 'user' | 'assistant', parts: [...] }`). A user message has one
`text` part and at most one `file` part (`mediaType: 'image/jpeg' | 'image/png' | 'image/webp'`, `url: data:` URL,
decoded ≤ 2 MB).

## Tools

Tool names (the UI part type is `tool-<name>`) and the Dutch status labels the client shows while they run:

| Name | Running label | Icon tone |
| --- | --- | --- |
| `getItem` | Item lezen… | app (warn) |
| `searchIntel` | Intel doorzoeken… | app |
| `getHintBoard` | Hintbord bekijken… | app |
| `getAreas` | Vossen bekijken… | app |
| `getFoxHistory` | Geschiedenis vos bekijken… | app |
| `getOurTeams` | Onze teams zoeken… | app |
| `convertCoordinates` | Coördinaten omzetten… | map (ok) |
| `checkPoint` | Punt checken… | map |
| `nearbyGroups` | Groepen in de buurt zoeken… | map |
| `distance` | Afstand meten… | map |
| `projectPoint` | Punt uitrekenen… | map |
| `geocode` | Plaats opzoeken… | map |
| `reverseGeocode` | Adres opzoeken… | map |
| `webSearch` | Zoeken op internet… | web (cooldown) |
| `readWebPage` | Pagina lezen… | web |
| `runCode` | Rekenen… | think (purple) |
| `showPoint` | Punt klaarzetten… | map |
| `proposeHintAnswer` | Antwoord klaarzetten… | map |

Every tool output is either its success shape or `{ error: string }`.

### Shapes the client renders (all other outputs are only summarised in ToolsUsed)

```ts
type LatLng = { lat: number; lng: number };
type Rd = { x: number; y: number };

type AreaEstimate = {
  area: string | null;               // e.g. 'alpha'; null when unknown
  method: 'hull' | 'nearest-group' | 'none';
};

type NearGroup = { name: string; area: string | null; distanceM: number };

// showPoint output
type PointResult = {
  label: string;
  latLng: LatLng;
  rd: Rd;
  rdText: string;                    // formatRdAnswer, e.g. "152341 431112"
  area: AreaEstimate;
  nearestGroup: NearGroup | null;
};

// proposeHintAnswer output
type HintAnswerProposal = {
  articleId: number;
  area: string;
  answer: string;                    // exactly what "Zet als antwoord" posts
  kind: 'rd' | 'text';
  point: PointResult | null;         // set when kind === 'rd'
};

// checkPoint output
type CheckPointResult = {
  point: PointResult;
  nearestGroups: NearGroup[];        // 5 nearest
  insideNl: boolean;
  otherHintPoints: { articleTitle: string; slotTime: string | null; distanceM: number }[]; // same area
  nearestTracker: { name: string; distanceM: number; ageMin: number } | null;
};

// webSearch output
type WebSearchResult = { answer: string; sources: { title: string; url: string }[] };
```

"Zet als antwoord" posts `{ answer }` to the existing `POST /hints/:articleId/:area/solve`.

### One-line summaries for ToolsUsed (client derives them from output)

`checkPoint` → "{point.area.area ?? 'onbekend gebied'} · {nearestGroups[0].name} {km}"; `nearbyGroups` → "{n} groepen";
`webSearch` → "{sources.length} bronnen"; `searchIntel` → "{results.length} items"; others → no summary line;
`{ error }` → the error text with a red dot.
