# Punten-kaart + ingestuurde opdrachten van jotihunt.nl

2026-10-17, approved by the user. UI picked in the visual companion: option **B** (getal + verdeelbalk),
`.superpowers/brainstorm/61717-1792226281/content/punten-card.html`.

## Why

The logged-in jotihunt.nl dashboard shows our provisional score ("Voorlopig aantal punten") split into Hunts,
Tegenhunts, Opdrachten, Foto opdrachten, Hints ("?" until judged) and Strafpunten. Each assignment page shows whether we
handed it in, the photo, our star rating and the judgement. Reading both saves people from checking the site and keeps
the Intel window's "Ingestuurd" status right without anyone setting it.

## Site facts (checked 17 Oct 2026, logged in)

- Dashboard `/scoutingGroup/dashboard`: under "Voorlopig aantal punten: N" a grid of
  `<div><div class="font-bold">Hunts: </div>0</div>` cells (labels `Hunts:`, `Tegenhunts:`, `Opdrachten:`,
  `Foto opdrachten:`, `Hints:`, `Strafpunten:`); a value can be empty (= 0) or `?` (unknown).
- Assignment page `/bericht/{id}` (ids of `type: "assignment"` from `GET /api/2.0/articles`), card "Insturen":
  - not handed in: an upload form (`action=".../article/assignment/{id}"`);
  - handed in: `<h2>Je hebt deze opdracht reeds ingestuurd</h2>`, `<p class="font-bold">Ingestuurd:</p>`, an
    `<img src="https://cdn.jotihunt.net/...">`, optional `Jullie waardering: ★★★★ (4 / 5)`, and a footer
    `<p class="font-bold">Nog niet beoordeeld</p>` (judged wording unknown yet: keep the footer text as-is and read a
    number of points from it when there is one).

## Server

- Uses the same HTTP session/login as the hunt sync (`jotihunt-scraper.service`).
- **Score**: read the dashboard every 2 minutes. Store the latest score; when the total changes keep `previousTotal` and
  `changedAt`. `GET /score` (any logged-in user):
  `{ configured, lastSuccessAt, lastError, total, parts: { hunts, counterHunts, assignments, photoAssignments, hints: number | null, penalty }, previousTotal, changedAt }`.
  `penalty` is the site's number as shown (positive = points subtracted); `total` is the site's total, never recomputed.
- **Submissions**: every 5 minutes open at most 5 assignment pages that are not judged yet (published assignments,
  newest first; one that is judged is not opened again). Store on `Assignment`: `site: { submitted, imageUrl, rating,
  judgement, points, checkedAt }`. When `submitted` becomes true and our status is open/busy (or there is no document),
  set status `submitted` (statusBy null = "jotihunt.nl"). Never change submitted/skipped set by people.
- Expose `site` in the assignments list (`GET /assignments`) and in the intel-chat assignment tool.
- Failures never break the hunt sync; errors show as `lastError` (short Dutch text) on `/score`.

## Web

- New sidebar section **Punten** directly under Hints, visible to everyone, hidden while `configured` is false.
  Collapsed header summary: `145 pnt`.
- Body (option B): big total (`145 pnt`), line `voorlopig · 1 min geleden` with a green `+10` (total − previousTotal)
  for 10 minutes after `changedAt`; a 200×10 px bar split by hunts / tegenhunts / opdrachten / foto (hints when known);
  a two-column legend with colour squares: Hunts, Opdrachten, Tegenhunts, Foto, Hints (`?` muted when unknown), Straf
  (red `−N`). When the last read failed: amber line `laatst gelukt 6 min geleden`.
- Animations: numbers count up, bar segments grow, `+10` pops in, card unfolds.
- Intel window assignment detail: when `site.submitted`, show the handed-in photo and the site's judgement (and points
  when known); the status card's submitted count follows the auto status.

## Out of scope

Android, push notifications for score changes, score history/chart.
