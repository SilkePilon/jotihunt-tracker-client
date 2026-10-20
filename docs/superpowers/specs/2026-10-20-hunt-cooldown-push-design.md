# Push when a fox may be hunted again

Date: 2026-10-20. Feature 3 of 5 from the GitHub scan. No mockup: one new tile in the existing Meldingen dialog.

## Goal

After we hunt a fox, the rules give a 1 hour cooldown before that fox may be hunted again. The site already shows it
(blue cooldown pill, `HUNT_COOLDOWN_MS`, `lastHuntTimeFor`). Now everyone gets a quiet push the moment that fox is
huntable again, so nobody has to watch the clock.

## Behaviour

### When

On every notifier run (every 10 s, `runNotifier`), per area:

- Last hunt = newest synced hunt (`Hunt`, from the jotihunt.nl sync) of that area with a `huntTime`, skipping hunts whose
  `statusText` contains "tegenhunt" (same rule as the client's `lastHuntTimeFor`, case-insensitive area match).
- Ready when `huntTime + 1 h <= now` and the area status is `green` or `orange`.
- Red or blue at that moment: no push yet; it goes out on the first run where the area is green/orange (still within
  the age limit below).
- No huntable-areas check: we only get a cooldown on a fox we hunted, and the server does not know our own team
  area (the client reads it from the API), so every hunted area counts.
- Once per hunt: `NotifierState.cooldownNotified` (map area → ISO `huntTime` already announced). A push only goes out
  for a `huntTime` newer than the stored one.
- Too old: when `huntTime + 1 h` is more than 2 hours ago, no push; the hunt time is just recorded as handled. Stops a
  flood after downtime or a late sync of an old hunt.
- First run (state not initialized) and the first run after this feature ships (`cooldownNotified` missing): record
  the current last hunt per area, send nothing.
- Same claim as the other types: `cooldownNotified` is part of the compare-and-set update of the state, and rolled back
  with it when storing the notifications fails.

### Push

- Type `hunt-cooldown`, `urgent: false`.
- Title `Alpha mag weer gehunt worden`; body `Groen · laatste hunt 14:05` (`Oranje · …`), Europe/Amsterdam clock.
- `data: { area, status, huntTime }`.
- Silent: the service worker shows it with `silent: true` (like "Happy hour voorbij"); in the app it gets an `info`
  toast and no sound (`isSilent` true for this type).
- Tap opens the app (existing behaviour).

### Client

- `NotificationType` + `OptionalNotificationType` gain `hunt-cooldown`.
- Meldingen tile: `{ type: 'hunt-cooldown', label: 'Weer huntbaar', short: '1 uur na onze hunt', description: 'Als
  een vos die we gehunt hebben na het uur weer gehunt mag worden (en groen of oranje is).' }`, icon lucide `TimerIcon`
  (tiles share one style, no per-type tone). On by default (as every optional type: not in `disabledTypes`).
- No row in the tour's `NotificationSoundsPanel`: it lists sounds to play, and this push has none.
- HQ director: ignores the type (no card, no camera move; the board's cooldown group shows it).
- Server `NOTIFICATION_TYPES` gains `hunt-cooldown`, so it is switchable (`OPTIONAL_NOTIFICATION_TYPES`).

## Structure

Server (`jotihunt-tracker-server`):
- `notifier.helpers.ts`: type; pure `huntCooldownReady({ lastHunts, status, notified, now })` returning the
  areas to announce + the new `cooldownNotified` map; `buildHuntCooldownNotification(area, status, huntTime)`.
- `notifier-state.model.ts`: `cooldownNotified: Map<string,string>` (optional, absent = not seeded).
- `notifier.service.ts`: read last hunt per area (one aggregate on `Hunt`), include in the claim + rollback.
- `push.service.ts` / payload unchanged (type + urgent already sent).

Client (`jotihunt-tracker-client`):
- `lib/notifications.ts` (types, option, `isSilent`), `NotificationsDialog.tsx` icon, `public/push-sw.js` silent rule, `notification-sounds.ts` /
  `SoundKey` only if the type needs a key (silent: map to `fox-status`, never played).

## Testing

- Server unit: ready after 1 h green/orange; waits while red then fires on green; blue never; tegenhunt ignored; once
  per hunt; newer hunt re-arms; >2 h old recorded without push; seeding sends nothing; claim
  rollback restores `cooldownNotified`; notification text.
- Client unit: tile list, toggle, `isSilent`, toast kind.
- Browser: Meldingen dialog shows the tile (desktop + phone, light + dark).

## Out of scope

Android app, a warning before the hour ends, our own submitted hunts starting the cooldown.
