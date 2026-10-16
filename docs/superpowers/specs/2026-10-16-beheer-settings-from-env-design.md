# Beheer settings instead of env + Gemini model picker — design

Date: 2026-10-16 · Repos: jotihunt-tracker-server, jotihunt-tracker-client (+ homelab for `SETTINGS_KEY`)
Mockups: client `.superpowers/brainstorm/392797-1792156368/content/` — `ai-tab.html` (A1), `algemeen.html` (B3), `telegram.html` (T1).

## Goal

Admins configure the app from Beheer instead of env. Moved settings:

| Group | Env vars today | Where in Beheer |
|---|---|---|
| Hunt window | client `HUNT_START_TIME`, `HUNT_END_TIME` | Algemeen → Hunt |
| Team identity | `HOME_TEAM_API_ID`, `GROUP_NAME` (client+server), client `LOGO_URL`, `DISCORD_URL` | Algemeen → Ons team |
| Traccar vehicle groups | `GROUP_WALKING_ID`, `GROUP_BIKE_ID`, `GROUP_CAR_ID`, `GROUP_MOTORCYCLE_ID` (client+server) | Algemeen → Voertuiggroepen |
| Jotihunt site login (secret) | `JOTIHUNT_WEB_USERNAME`, `JOTIHUNT_WEB_PASSWORD` | Algemeen → Jotihunt-site |
| Gemini key (secret) | `GEMINI_API_KEY` | new AI tab |
| Gemini models | `GEMINI_MODEL`, `GEMINI_CHAT_MODEL`, `GEMINI_PREDICTION_MODEL` | new AI tab, 7 slots |
| Telegram app creds (secret) | `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_BOT_USERNAME` | Koppelingen → Telegram card |

Stays in env: infra (MONGO_URI, PORT, WEBAUTHN_*, PUBLIC_APP_URL, TRUST_PROXY, CLIENT_IP_HEADER, Traccar URL/token, JOTIHUNT_API_URL/WEB_URL, VAPID_*, Sentry, dirs), the AES session keys, `ORS_API_KEY`, `NS_API_KEY`, `TEAMS_AREA_EDITING`, `JWT_SECRET`. New: `SETTINGS_KEY`.

## Resolution rule

Every moved value resolves **DB → env → default**. The env fallback keeps existing deploys working. Each resolved value carries `source: 'db' | 'env' | 'default'`; the UI shows an "uit .env" pill when `source === 'env'`. Clearing a DB value falls back to env again.

## Server

### Settings layer — `src/settings/app-config.ts`
- Same pattern as `prediction-setting.ts` / `huntable-areas-setting.ts`: `settings` collection on the demo-state connection, one document per key, loaded at boot (`src/index.ts` next to the others), module cache, setters write DB then cache.
- Keys:
  - `general`: `{ huntStart?: Date, huntEnd?: Date, homeTeamApiId?: number, groupName?: string, logoUrl?: string, discordUrl?: string, vehicleGroups?: { walking?, bike?, car?, motorcycle?: number } }`
  - `ai`: `{ models: Partial<Record<AiSlot, string>> }` with `AiSlot = 'ocr' | 'summary' | 'split' | 'prediction' | 'chat' | 'deep' | 'tools'`
  - `secrets`: `{ encrypted: { [name]: { ciphertext, iv, tag, hint } }, plain: { jotihuntWebUsername?, telegramApiId?, telegramBotUsername? } }`. Encrypted names: `geminiApiKey`, `jotihuntWebPassword`, `telegramApiHash`.
- Secrets: AES-256-GCM via `src/services/session-crypto.ts` with key `SETTINGS_KEY` (validated by `isValidSessionKey`). `hint` = masked form (`AIza…fZ`, `••••`). Without a valid `SETTINGS_KEY`: secret reads fall back to env, secret writes return 409 `settings_key_missing`.
- `onConfigChange(key, listener)` — tiny emitter fired after every successful write.
- Getters: `huntWindow()`, `homeTeam()`, `groupName()`, `vehicleGroupIds()`, `geminiApiKey()`, `aiModel(slot)`, `jotihuntLogin()`, `telegramApp()` — each returns `{ value, source }` or the plain value where source isn't needed.
- Existing `groupConfig()` (`src/auth/config.ts`) and `vehicleGroupIdsFromEnv` callers switch to these getters.

### Consumers rebuilt on change
- **Gemini** (`src/services/ai/model.ts`): `createModels()` becomes a cached provider rebuilt when `secrets.geminiApiKey` or `ai` changes; `byPurpose(slot)` reads `aiModel(slot)`. Replace the module-level `models` constants in `hunt-ocr.instance.ts`, `article-summaries.cron.ts`, `hint-split.cron.ts`, `prediction/instance.ts` and the cache in `intel-chat/instance.ts` with calls to the getter at use time.
- Slot mapping (defaults = today's behaviour): `ocr`, `summary`, `split`, `chat`, `tools` → `gemini-3.8-flash`; `prediction`, `deep` → `gemini-pro-latest`. Env fallback per slot: `ocr/summary/split` ← `GEMINI_MODEL`, `chat/tools` ← `GEMINI_CHAT_MODEL`, `prediction/deep` ← `GEMINI_PREDICTION_MODEL`.
- **Scraper** (`jotihunt-scraper.service.ts`): reads login per run; on change drops its session so next run logs in fresh. Cron schedule check (`crons/schedule.ts:25`) uses the getter.
- **Telegram** (`telegram.service.ts`): reads app creds via `telegramApp()`; on change disconnects and, if a session exists, reconnects. Bot username used for message filtering read per message.
- **Onboarding/Traccar** (`tracker-onboarding.*`): vehicle group ids read per call.

### Routes
- `GET /config` — **public** (invite page needs name/logo before login): `{ groupName, logoUrl, discordUrl, huntStart, huntEnd, homeTeamApiId, vehicleGroups }`. No secrets, no sources.
- Admin (`verifyToken` + `isAdmin`, under `/admin`):
  - `GET /admin/config` → public fields + `sources` + `secrets: { [name]: { set, hint, source } }` + `settingsKeyOk`.
  - `PUT /admin/config/general` → validates and saves all general fields at once (express-validator: ISO dates with end > start, positive ints, URLs http(s) or `/…`).
  - `PUT /admin/config/secrets/:name` `{ value }`, `DELETE /admin/config/secrets/:name`.
  - `PUT /admin/config/telegram` `{ apiId, apiHash?, botUsername }`.
  - `POST /admin/config/logo` multipart image (png/jpg/svg/webp, ≤1 MB) → stored `UPLOADS_DIR/branding/logo.<ext>`, served at `GET /branding/logo` (public); sets `logoUrl`.
  - `GET /admin/traccar/groups` → `[{ id, name }]` from Traccar `/api/groups`.
  - `POST /admin/jotihunt/test-login` → tries a scraper login with current (or posted) creds → `{ ok, error? }`.
  - `GET /admin/ai/models` → server calls `GET https://generativelanguage.googleapis.com/v1beta/models?key=…&pageSize=1000`, keeps `name` starting `models/gemini-` with `generateContent` in `supportedGenerationMethods`, drops names containing `embedding|imagen|tts|image|live|audio`; returns `[{ id, displayName, group: 'alias' | 'latest' | 'older' }]` (`-latest` = alias; highest version number = latest). Cached 10 min per key; `?refresh=1` bypasses.
  - `PUT /admin/ai/models` `{ models: Partial<Record<AiSlot, string|null>> }` (null = back to default). Unknown ids allowed only if present in the cached list.
  - `POST /admin/ai/test/:slot` → `generateText` "Antwoord met OK." with that slot's model → `{ ok, ms, error? }`.

## Client

- `useAppConfig()` (`src/hooks/app-config.hook.ts`): SWR on `/config`, `revalidateOnFocus`, `refreshInterval: 60_000`. Returns parsed dates and a `vehicleGroupIds` map.
- Replace env reads (see list in research): `HUNT_START_TIME/END_TIME` (HintEntryCard, Markers, MarkerRegistration, next-hint.hook, StatusCard), `HOME_TEAM_API_ID` (teams.hook, counter-hunt.hook, SidebarSections, MobileMenu), `GROUP_*_ID` (Devices, HuntersPane via `vehicleGroupIdsFromEnv`), `GROUP_NAME` (Map, SidebarHeader), `LOGO_URL` (SidebarHeader, Invite), `DISCORD_URL` (Settings). Module-level constants move into hooks/args.
- Remove those vars from client `.env.example` (vite-envs declaration) and server/root `.env.example`; add `SETTINGS_KEY` to server/root examples.
- `useAdminConfig()`, `useAiModels()` hooks for Beheer.

### UI (Beheer theme: D1 cards, tonal rows, no icons in card titles, 12px button rounding, motion/react for every state change)
- **AI tab (A1)** — new nav item "AI" after Algemeen (`WindowNav`), `AiPane.tsx`:
  - Card "Gemini-sleutel": masked key row (eye toggle, Wijzigen → inline input + Opslaan/Annuleer, Wissen), status pill (Werkt · n modellen / uit .env / Sleutel geweigerd / Geen sleutel), amber bar on rejected key, amber bar when `SETTINGS_KEY` missing.
  - Card "Modellen" + "Standaard herstellen": 7 rows (icon, title, one-line uitleg) with Test button (spinner → "✓ 0,8 s" / error) and dropdown popover (search field, groups Aliassen / nieuwste / ouder, "standaard" tag, footer "Lijst van Google · x min geleden" + refresh). Without key: note "Voeg eerst een sleutel toe".
  - Row copy: Foto OCR · Artikel-samenvattingen · Hint splitsen · Vos-voorspelling · Intel-chat · Chat "Denk diep" · Chat-hulpmiddelen.
- **Algemeen (B3)** — below "Welke vossen mogen we hunten?", before Functies: cards Hunt (timeline now→start→end + Start/Einde datetime fields), Ons team (team dropdown from `useTeams`, Groepsnaam, Logo preview + URL + Uploaden, Discord-link), Voertuiggroepen (4 dropdowns from Traccar groups), Jotihunt-site (username, password, status pill, "Inloggen testen"). Labels above fields; "uit .env" pill per card when sourced from env. Any change shows a floating save bar "Niet-opgeslagen wijzigingen · Terugzetten · Opslaan" (animates in/out); dropdowns also go through the bar. Password saves via the secrets route on Opslaan.
- **Telegram (T1)** — KoppelingenPane Telegram card: without app creds, Koppelen opens a 4-step flow whose step 1 is "App-gegevens van Telegram" (API ID, API hash, Bot; link to my.telegram.org), then the existing QR steps. With creds: muted line "App-gegevens: 2451873 · @Jotihunt_bot [uit .env] · wijzigen" opening the same fields inline. Koppelen disabled + amber bar when `SETTINGS_KEY` missing and no env creds.

## Error handling
- Bad Gemini key: models list call returns 400/403 → key card amber bar; AI features behave as today when unusable.
- Model list fetch fails: dropdown shows current id + "Lijst niet beschikbaar" + retry.
- Save failures: toast + save bar stays.
- Logo upload too big / wrong type: inline error under the field.

## Testing
- Server (bun test, `jotihunt-test` DB): DB→env→default resolution + source; secrets encrypt/decrypt round trip and never in any response; 409 without `SETTINGS_KEY`; model list filter/grouping on a fixture; Gemini provider rebuilt after key/model change; general validation (end > start, ints); `/config` public shape.
- Client: `tsc -b`, preview check of the three screens (states from the mockups).

## Rollout
Server: settings layer + general config → AI key/models → secrets (Jotihunt, Telegram). Client branch with all UI. Homelab PR adds `SETTINGS_KEY` to `jotihunt-secret` (needs user approval). Env values on k3s keep working as fallback.
