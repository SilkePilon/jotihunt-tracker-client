# Partly solved hints: wildcard digits with candidates on the map

Date: 2026-10-19. Feature 1 of 5 from the GitHub scan of other Jotihunt tools (idea from Jotify's "Probeer" probe).
Mockup: `.superpowers/brainstorm/585396-1792443839/content/wildcard-layout.html`, option **A** picked.

## Goal

A hint is often solved except for one or two digits. Let a hunter type `?` for an unknown digit and see every
possible location on the map, judged against where that fox could have walked to, then tap the right one to fill it in.
Only the person typing sees this; nothing is stored or shared.

## Behaviour

### Input

- **Hint registreren card** (`HintEntryCard`): each of the 6 digit boxes per axis also accepts `?`. The keys `.` `,` `*`
  `-` and space are turned into `?` (a phone's number keyboard has no `?`); the boxes use `inputMode="decimal"` so `.`
  or `,` is always there. A wildcard box is purple with a dashed inner border (`--guess` colours below).
- **Intel hint row** (`HintPane` → `AreaBody`): the free-text answer field accepts `?` in every format the server
  parser reads: `1234 5678`, `12345678`, `123400 567800`, `123400567800` (separators whitespace `,` `;`). `?` takes the
  place of a digit; length rules stay the same (4+4, 8, 6+6, 12).

### Candidates

- RD values: 4-digit parts are hectometres (×100), 6-digit parts are metres.
- **Exactly one `?` in total** (either axis): up to 10 numbered dots (the digit the `?` would be). Candidates outside the
  RD grid (`isPlausibleRD`) or outside the Netherlands (`isInNetherlands`) are dropped.
- **Collapse rule**: if all candidates lie within 50 m of each other (e.g. `15760? 434400`), show one dot with the line
  "onbekend cijfer maakt niet uit"; picking it fills `0`.
- **Two or more `?`**: one purple rectangle in RD (min..max per axis over all matches), drawn as a densified polygon in
  WGS84, fill + dashed outline. If it spans more than 60 km on either axis the status says "te breed — vul meer cijfers
  in" and nothing is drawn. No dots, nothing to pick; the user types more digits.
- When both axes are fully typed (no `?`), the guess disappears and today's behaviour applies.

### Plausibility (only with an area and a time)

- Area + time come from the card's pickers, or the Intel row's area + the hint article's publish time.
- `lastFoxFix`: newest marker of type `hint` or `hunt` for that area with `time` before the hint time.
- Reach radius = 6 km/h × (hint time − fix time), shown as a red dashed circle around the fix (red = the existing fox
  error/red tone).
- Dots inside the reach are normal, outside are faded (40 % opacity). The candidate inside the reach closest to the fix
  is "best" (larger, filled purple). Rectangles get the circle too, no ranking.
- No area, no time, or no earlier fix: no circle, all dots equal, no "best".

### Status texts

- Card (`CoordinateStatus`, new state `guess`): "N mogelijk · tik er een op de kaart", collapse: "Onbekend cijfer maakt
  niet uit · tik de stip", wide: "Te breed — vul meer cijfers in", rectangle: "Gebied op kaart · vul meer cijfers in".
- Intel preview line (new kind `guess`): same texts plus a "Toon op kaart" pill. Registreren/Opslaan stay as they are:
  the card's Registreren is disabled while a `?` is present; Intel's Opslaan with a `?` would save text, so Opslaan is
  disabled while the field contains `?`.

### Picking

- Clicking a candidate dot calls `pick(index)`.
- From the card: the filled x/y go through the existing `useHintFormBridge` (`setCoords`), the card fills, the guess
  clears, Registreren works again (the user still presses it).
- From Intel: "Toon op kaart" closes the Intel window (`close()`, then shows the guess after `INTEL_CLOSE_MS`). Picking a
  dot stores `pendingAnswer = {articleId, area, text}` (the filled answer in the format the user typed) and calls
  `openIntel(articleId, area)`. The row, on mount, fills its field from a matching `pendingAnswer` and clears it. Not
  saved until Opslaan.

### Clearing

The guess clears when: the answer becomes complete, Wissen, the card unmounts, the Intel field changes to something
without `?` or the row closes (for the Intel source only while the Intel window is open; once the window closed for
"Toon op kaart" the guess stays until a pick, Escape, or a new guess). Escape while a guess is on the map clears it.

## Structure (client only, no server change)

- `src/lib/hint-guess.ts` (pure, unit tested):
  - `normalizeWildcard(char)`: `. , * -` space → `?`.
  - `parseGuess(xPattern, yPattern)`: `{kind: 'points', points: [{digit, x, y, lng, lat}], collapsed}` |
    `{kind: 'area', polygon, wide}` | `null` (no `?` / not enough characters).
  - `parseGuessAnswer(text)`: splits like `parseRdAnswer` with `?` allowed, returns patterns + a `fill(point)` that
    renders the answer back in the typed format.
  - `lastFoxFix(markers, area, before)`.
  - `rankGuess(guess, fix, at)`: reach circle polygon, per-point `inReach`, `bestIndex`.
- `src/stores/hint-guess.store.ts` (zustand): `{guess, source: 'card' | 'intel', area, at, articleId, pendingAnswer,
  show, clear, pick}`.
- `src/components/layers/HintGuess.tsx`: GeoJSON source; circle layer for dots, symbol layer for the digit labels,
  fill + dashed line for the rectangle, dashed red line for the reach circle. Layer ids added to `MAP_LAYER_STACK`
  above the fox markers; dot clicks through `map-interactions`.
- `DigitBoxes`: pattern `^[0-9?]*$` after normalizing, `?` slot style, `inputMode="decimal"`.
- `HintEntryCard`, `CoordinateStatus`, `HintPane` changes as described.
- Colours: CSS variables `--guess` (line/fill accent), `--guess-container`, `--on-guess-container`, light + dark, with
  Tailwind theme entries, next to the existing `--fox-*` tokens in `src/index.css`. Light: `#7b61d1` / `#e8e2f8` /
  `#3b2a73`; dark: `#b9a6ff` / `#352a5c` / `#e3dbff`.
- Animations: dots/rectangle fade + scale in when the guess appears or changes and fade out on clear (map paint
  transitions); status line swaps with the existing `SWAP` motion.

## Error handling

- Invalid characters are ignored by the boxes / show the existing "Geen geldige RD-coördinaat" line in Intel.
- All candidates dropped (outside NL): status "Geen mogelijkheden in Nederland".
- Markers not loaded yet: no plausibility, everything else works.

## Testing

- Unit tests for `hint-guess.ts`: wildcard normalising, 4- and 6-digit parts, one `?` → 10 points with right spacing,
  NL filtering, collapse rule, two `?` → rectangle bounds, wide rule, `parseGuessAnswer` formats + `fill` round trip,
  `lastFoxFix` picks the newest earlier hint/hunt of the area, `rankGuess` reach + best.
- Browser check of the card and Intel flow in a dev harness (light + dark, phone width).

## Out of scope

Sharing guesses with the team, server endpoint, Android app, prefills like `1***` per area.
