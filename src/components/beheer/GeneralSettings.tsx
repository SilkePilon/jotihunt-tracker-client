import { useId, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { CheckIcon, Loader2Icon } from 'lucide-react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import Reveal from '@/components/motion/Reveal';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { testJotihuntLogin, useAdminConfig, useTraccarGroups } from '@/hooks/app-config.hook';
import { useNow } from '@/hooks/now.hook';
import { useTeams } from '@/hooks/teams.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { apiAssetUrl, draftFrom, fromLocalInput, generalPatch, isDirty, timelineGeometry, type AdminConfig, type GeneralDraft } from '@/lib/app-config';
import { POP, REVEAL_TRANSITION, SWAP_TRANSITION } from '@/lib/motion';
import { VEHICLE_ICONS, VEHICLE_OPTIONS } from '@/lib/tracker';
import { cn, getColorFromArea } from '@/lib/utils';
import type { Vehicle } from '@/types/Tracker';
import { BeheerCard, BeheerSkeleton, WarnBar } from './BeheerLayout';
import { Pill, Tag } from './controls/Pill';

/** Text inputs and select triggers: 36px, 12px corners, tonal fill */
const FIELD = 'h-9 rounded-lg border-0 bg-beheer-row-high text-[13px] shadow-none md:text-[13px] dark:bg-beheer-row-high';
const NO_GROUP = 'none';
const NEEDS_PASSWORD_HINT = 'Vul ook het wachtwoord in om de nieuwe gebruikersnaam te testen.';
const TIMELINE_TICK_MS = 60_000;
const LOGO_TYPES = 'image/png,image/jpeg,image/webp,image/svg+xml';

/** Label above a field, and an error line that folds in under it. */
function Field({ label, htmlFor, error, className, children }: { label: ReactNode; htmlFor?: string; error?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={htmlFor} className="mb-1 ml-0.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground">
        {label}
      </label>
      {children}
      <AnimatePresence initial={false}>
        {error && (
          <motion.span key="error" className="block overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={REVEAL_TRANSITION}>
            <span className="mt-1 ml-0.5 block text-xs text-destructive">{error}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/** "uit .env" in a card header; pops in and out. */
function EnvTag({ show }: { show: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.span key="env" {...POP} className="inline-flex">
          <Tag tone="info">uit .env</Tag>
        </motion.span>
      )}
    </AnimatePresence>
  );
}

const dayTime = new Intl.DateTimeFormat('nl-NL', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
/** "za 09:00" */
const formatDayTime = (ms: number) => dayTime.format(ms);

/** Track with the hunt as an orange stretch, a white "nu" tick and labels; the stretch slides when the times change. */
function HuntTimeline({ start, end }: { start: string | null; end: string | null }) {
  const now = useNow(true, TIMELINE_TICK_MS);
  const startMs = start ? Date.parse(start) : NaN;
  const endMs = end ? Date.parse(end) : NaN;
  const ready = !Number.isNaN(startMs) && !Number.isNaN(endMs);
  return (
    <AnimatePresence initial={false}>
      {ready && (
        <motion.div key="timeline" className="overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={REVEAL_TRANSITION}>
          <Timeline startMs={startMs} endMs={endMs} now={now} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Timeline({ startMs, endMs, now }: { startMs: number; endMs: number; now: number }) {
  const geo = timelineGeometry(startMs, endMs, now);
  const end = geo.left + geo.width;
  // Leave out the "nu" label when it would run into a time label
  const nowLabel = geo.now !== null && Math.abs(geo.now - geo.left) > 9 && Math.abs(geo.now - end) > 9;
  const label = 'absolute top-[30px] -translate-x-1/2 text-[10.5px] whitespace-nowrap text-muted-foreground tabular-nums';
  return (
    <div className="relative mx-2 mt-1.5 mb-0.5 h-11" aria-hidden>
      <div className="absolute inset-x-0 top-[18px] h-2 rounded-md bg-beheer-row" />
      <motion.div className="absolute top-[18px] h-2 rounded-md bg-primary" initial={false} animate={{ left: `${geo.left}%`, width: `${geo.width}%` }} transition={SWAP_TRANSITION} />
      <AnimatePresence initial={false}>
        {geo.now !== null && (
          <motion.div
            key="now"
            className="absolute top-2.5 h-6 w-0.5 -translate-x-1/2 rounded-sm bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.15)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, left: `${geo.now}%` }}
            exit={{ opacity: 0 }}
            transition={SWAP_TRANSITION}
          />
        )}
        {nowLabel && (
          <motion.span key="now-label" className={label} initial={{ opacity: 0 }} animate={{ opacity: 1, left: `${geo.now}%` }} exit={{ opacity: 0 }} transition={SWAP_TRANSITION}>
            nu
          </motion.span>
        )}
      </AnimatePresence>
      <motion.span className={label} initial={false} animate={{ left: `${geo.left}%` }} transition={SWAP_TRANSITION}>
        {formatDayTime(startMs)}
      </motion.span>
      <motion.span className={label} initial={false} animate={{ left: `${end}%` }} transition={SWAP_TRANSITION}>
        {formatDayTime(endMs)}
      </motion.span>
    </div>
  );
}

function DateTimeInput({ id, value, invalid, onChange }: { id: string; value: string; invalid?: boolean; onChange: (value: string) => void }) {
  return (
    <Input
      id={id}
      type="datetime-local"
      value={value}
      aria-invalid={invalid || undefined}
      onChange={(event) => onChange(event.target.value)}
      className={cn(FIELD, 'tabular-nums [color-scheme:light] dark:[color-scheme:dark]')}
    />
  );
}

/** Sticky at the bottom of the pane while there are changes; slides up, and the cards below make room smoothly. */
function SaveBar({ show, saving, disabled, onReset, onSave }: { show: boolean; saving: boolean; disabled: boolean; onReset: () => void; onSave: () => void }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="savebar"
          // -14px cancels the column's gap, so the bar takes no room once folded away
          className="sticky bottom-4 z-10 -mt-3.5"
          style={{ overflow: 'hidden' }}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
          exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
          transition={SWAP_TRANSITION}
        >
          <div className="pt-3.5">
            <motion.div
              initial={{ y: 24 }}
              animate={{ y: 0 }}
              exit={{ y: 24 }}
              transition={SWAP_TRANSITION}
              className="flex items-center gap-2.5 rounded-2xl border border-border bg-beheer-row-high py-2.5 pr-2.5 pl-4 shadow-lg"
            >
              <span className="min-w-0 flex-1 text-[13px] font-medium">Niet-opgeslagen wijzigingen</span>
              <Pill variant="ghost" disabled={saving} onClick={onReset}>
                Terugzetten
              </Pill>
              <Pill variant="primary" morphKey={saving ? 'busy' : 'idle'} disabled={disabled || saving} onClick={onSave}>
                {saving && <Loader2Icon className="animate-spin" />}
                Opslaan
              </Pill>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type LoginState = 'idle' | 'busy' | 'ok' | 'fail';

function LoginTag({ state }: { state: LoginState | 'none' | null }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {state && (
        <motion.span key={state} {...POP} className="inline-flex">
          {state === 'ok' ? (
            <Tag tone="ok">
              <CheckIcon />
              Ingelogd
            </Tag>
          ) : state === 'busy' ? (
            <Tag tone="neutral">
              <Loader2Icon className="animate-spin" />
              Testen…
            </Tag>
          ) : state === 'fail' ? (
            <Tag tone="warn">Inloggen mislukt</Tag>
          ) : (
            <Tag tone="neutral">Niet ingesteld</Tag>
          )}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/** Beheer → Algemeen (B3): Hunt, Ons team, Voertuiggroepen and Jotihunt-site as always-open forms with one save bar. */
export default function GeneralSettings() {
  const admin = useAdminConfig();
  const { teams } = useTeams();
  const traccar = useTraccarGroups(true);
  const authHeader = useAuthHeader() || '';
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  // null = untouched: the form shows the saved values (and follows them when they reload)
  const [edited, setEdited] = useState<GeneralDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [login, setLogin] = useState<LoginState>('idle');

  const config = admin.config;
  if (!config) {
    return admin.isError ? (
      <BeheerCard title="Hunt">
        <p className="mx-1 text-sm text-muted-foreground">De instellingen konden niet worden geladen.</p>
      </BeheerCard>
    ) : (
      <BeheerSkeleton groups={2} />
    );
  }

  const saved = draftFrom(config);
  const draft = edited ?? saved;
  const set = <K extends keyof GeneralDraft>(key: K, value: GeneralDraft[K]) => {
    const next = { ...draft, [key]: value };
    // Back to the saved values = untouched again, so a reload of the config carries through
    setEdited(isDirty(saved, next) ? next : null);
  };
  const setLoginField = (key: 'jotihuntWebUsername' | 'jotihuntWebPassword', value: string) => {
    set(key, value);
    // A test result was for the old values
    if (login !== 'busy') setLogin('idle');
  };
  const setVehicle = (vehicle: Vehicle, group: number | null) => set('vehicleGroups', { ...draft.vehicleGroups, [vehicle]: group });

  const endBeforeStart = !!draft.huntStart && !!draft.huntEnd && draft.huntEnd <= draft.huntStart;
  const dirty = isDirty(saved, draft);
  const fromEnv = (...keys: (keyof AdminConfig['general'])[]) => keys.some((key) => config.general[key].source === 'env');
  const password = config.secrets.jotihuntWebPassword;
  const siteConfigured = !!config.plain.jotihuntWebUsername.value && password.set;
  const typedLogin = draft.jotihuntWebUsername.trim() && draft.jotihuntWebPassword ? { username: draft.jotihuntWebUsername.trim(), password: draft.jotihuntWebPassword } : undefined;
  // The server can't pair a typed username with the stored password: a test would silently use the saved login
  const needsPassword = draft.jotihuntWebUsername !== saved.jotihuntWebUsername && !draft.jotihuntWebPassword && password.set;
  const loginTag = login !== 'idle' ? login : siteConfigured ? null : 'none';

  const sortedTeams = teams?.slice().sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  const groups = traccar.groups ?? [];

  async function save() {
    setSaving(true);
    try {
      const patch = generalPatch(saved, draft);
      if (Object.keys(patch).length) await admin.saveGeneral(patch);
      if (draft.jotihuntWebUsername !== saved.jotihuntWebUsername) await admin.savePlain({ jotihuntWebUsername: draft.jotihuntWebUsername.trim() || null });
      if (draft.jotihuntWebPassword) await admin.saveSecret('jotihuntWebPassword', draft.jotihuntWebPassword);
      setEdited(null);
      toast.success('Opgeslagen');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Opslaan is mislukt.'));
    } finally {
      setSaving(false);
    }
  }

  async function testLogin() {
    setLogin('busy');
    const result = await testJotihuntLogin(authHeader, typedLogin);
    setLogin(result.ok ? 'ok' : 'fail');
    if (!result.ok) toast.error(result.error);
  }

  async function upload(file: File) {
    setUploading(true);
    try {
      const next = await admin.uploadLogo(file);
      // Keep other edits; the logo field takes the uploaded url (otherwise saving would put the old one back)
      const logoUrl = draftFrom(next).logoUrl;
      setEdited((current) => current && { ...current, logoUrl });
      toast.success('Logo geüpload');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Uploaden is mislukt.'));
    } finally {
      setUploading(false);
    }
  }

  const logoSrc = apiAssetUrl(draft.logoUrl.trim() || '/logo.svg');

  return (
    <>
      <BeheerCard title="Hunt" description="Wanneer de hunt loopt." right={<EnvTag show={fromEnv('huntStart', 'huntEnd')} />}>
        <HuntTimeline start={fromLocalInput(draft.huntStart)} end={fromLocalInput(draft.huntEnd)} />
        <div className="mx-1 mt-2 grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
          <Field label="Start" htmlFor={`${id}-start`}>
            <DateTimeInput id={`${id}-start`} value={draft.huntStart} onChange={(value) => set('huntStart', value)} />
          </Field>
          <Field label="Einde" htmlFor={`${id}-end`} error={endBeforeStart ? 'Einde moet na de start liggen.' : undefined}>
            <DateTimeInput id={`${id}-end`} value={draft.huntEnd} invalid={endBeforeStart} onChange={(value) => set('huntEnd', value)} />
          </Field>
        </div>
      </BeheerCard>

      <BeheerCard title="Ons team" right={<EnvTag show={fromEnv('homeTeamApiId', 'groupName', 'logoUrl', 'discordUrl')} />}>
        <div className="mx-1 grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
          <Field label="Team in Jotihunt-lijst" htmlFor={`${id}-team`}>
            <Select value={draft.homeTeamApiId !== null ? String(draft.homeTeamApiId) : sortedTeams ? NO_GROUP : ''} onValueChange={(value) => set('homeTeamApiId', value === NO_GROUP ? null : Number(value))} disabled={!sortedTeams}>
              <SelectTrigger id={`${id}-team`} className={cn(FIELD, 'w-full font-medium')}>
                <SelectValue placeholder={sortedTeams ? 'Kies ons team' : 'Teams laden…'} />
              </SelectTrigger>
              <SelectContent className="max-h-72 rounded-2xl">
                <SelectItem value={NO_GROUP} className="rounded-lg text-muted-foreground">
                  Geen team
                </SelectItem>
                {sortedTeams?.map((team) => (
                  <SelectItem key={team._id} value={String(team.apiId)} className="rounded-lg">
                    <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: team.area ? getColorFromArea(team.area) : 'var(--border)' }} />
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Groepsnaam" htmlFor={`${id}-name`}>
            <Input id={`${id}-name`} value={draft.groupName} onChange={(event) => set('groupName', event.target.value)} placeholder="Scouting …" className={FIELD} />
          </Field>
          <Field label="Logo" htmlFor={`${id}-logo`}>
            <div className="flex gap-1.5">
              <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.img key={logoSrc} src={logoSrc} alt="" className="size-7 object-contain" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} />
                </AnimatePresence>
              </span>
              <Input id={`${id}-logo`} value={draft.logoUrl} onChange={(event) => set('logoUrl', event.target.value)} placeholder="/logo.svg" className={cn(FIELD, 'flex-1')} spellCheck={false} />
              <Pill variant="secondary" size="md" morphKey={uploading ? 'busy' : 'idle'} disabled={uploading} onClick={() => fileInput.current?.click()}>
                {uploading && <Loader2Icon className="animate-spin" />}
                Uploaden
              </Pill>
              <input
                ref={fileInput}
                type="file"
                accept={LOGO_TYPES}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void upload(file);
                }}
              />
            </div>
          </Field>
          <Field label="Discord-link" htmlFor={`${id}-discord`}>
            <Input id={`${id}-discord`} value={draft.discordUrl} onChange={(event) => set('discordUrl', event.target.value)} placeholder="https://discord.gg/…" className={FIELD} spellCheck={false} />
          </Field>
        </div>
      </BeheerCard>

      <BeheerCard title="Voertuiggroepen" description="Traccar-groep per voertuig." right={<EnvTag show={fromEnv('vehicleGroups')} />}>
        <div className="mx-1 grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-4">
          {VEHICLE_OPTIONS.map(({ value: vehicle, label }) => {
            const Icon = VEHICLE_ICONS[vehicle];
            const current = draft.vehicleGroups[vehicle];
            // A stored group Traccar doesn't list (or can't be reached) still shows as its id
            const options = current !== null && !groups.some((group) => group.id === current) ? [...groups, { id: current, name: `Groep ${current}` }] : groups;
            return (
              <Field
                key={vehicle}
                htmlFor={`${id}-${vehicle}`}
                label={
                  <>
                    <Icon className="size-3.5" />
                    {label}
                  </>
                }
              >
                <Select value={current !== null ? String(current) : NO_GROUP} onValueChange={(value) => setVehicle(vehicle, value === NO_GROUP ? null : Number(value))}>
                  <SelectTrigger id={`${id}-${vehicle}`} className={cn(FIELD, 'w-full font-medium')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 rounded-2xl">
                    <SelectItem value={NO_GROUP} className="rounded-lg text-muted-foreground">
                      Geen groep
                    </SelectItem>
                    {options.map((group) => (
                      <SelectItem key={group.id} value={String(group.id)} className="rounded-lg">
                        {group.name}
                        <span className="text-xs text-muted-foreground tabular-nums">#{group.id}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            );
          })}
        </div>
        <AnimatePresence initial={false}>
          {traccar.isError && (
            <motion.p key="traccar" className="overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={REVEAL_TRANSITION}>
              <span className="mx-1 block pt-2 text-xs text-muted-foreground">Traccar niet bereikbaar</span>
            </motion.p>
          )}
        </AnimatePresence>
      </BeheerCard>

      <BeheerCard
        title="Jotihunt-site"
        description="Login van jotihunt.nl."
        right={
          <span className="flex shrink-0 items-center gap-1.5">
            <LoginTag state={loginTag} />
            <EnvTag show={config.plain.jotihuntWebUsername.source === 'env' || password.source === 'env'} />
          </span>
        }
      >
        <div className="mx-1 grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
          <Field label="Gebruikersnaam" htmlFor={`${id}-user`}>
            <Input
              id={`${id}-user`}
              value={draft.jotihuntWebUsername}
              onChange={(event) => setLoginField('jotihuntWebUsername', event.target.value)}
              className={FIELD}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field label="Wachtwoord" htmlFor={`${id}-password`}>
            <Input
              id={`${id}-password`}
              type="password"
              value={draft.jotihuntWebPassword}
              onChange={(event) => setLoginField('jotihuntWebPassword', event.target.value)}
              placeholder={password.hint ?? ''}
              className={FIELD}
              autoComplete="new-password"
            />
          </Field>
        </div>
        <div className="mx-1 mt-2.5">
          <Pill
            variant="secondary"
            disabled={login === 'busy' || needsPassword || (!typedLogin && !siteConfigured)}
            title={needsPassword ? NEEDS_PASSWORD_HINT : undefined}
            onClick={() => void testLogin()}
          >
            Inloggen testen
          </Pill>
        </div>
        <Reveal>{needsPassword && <p className="mx-1 pt-1.5 text-xs text-muted-foreground">{NEEDS_PASSWORD_HINT}</p>}</Reveal>
        <AnimatePresence initial={false}>
          {password.undecryptable && <WarnBar key="undecryptable">Opgeslagen wachtwoord kan niet worden ontsleuteld; vul het opnieuw in.</WarnBar>}
        </AnimatePresence>
      </BeheerCard>

      <SaveBar show={dirty} saving={saving} disabled={endBeforeStart} onReset={() => setEdited(null)} onSave={() => void save()} />
    </>
  );
}
