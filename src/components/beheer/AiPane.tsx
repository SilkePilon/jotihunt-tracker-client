import { useEffect, useRef, useState, type ComponentType } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { BrainIcon, CameraIcon, CheckIcon, FileTextIcon, KeyRoundIcon, ListTreeIcon, Loader2Icon, MessageCircleIcon, PlayIcon, RadarIcon, WrenchIcon } from 'lucide-react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import Reveal from '@/components/motion/Reveal';
import { Input } from '@/components/ui/input';
import { testAiSlot, useAdminConfig, useAiModels } from '@/hooks/app-config.hook';
import { useIsMobile } from '@/hooks/media.hook';
import { AI_SLOTS, type AiSlot } from '@/lib/app-config';
import { apiErrorMessage } from '@/lib/api-error';
import { POP, SWAP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { BeheerCard, BeheerPane, BeheerRow, BeheerRows, BeheerSkeleton, WarnBar } from './BeheerLayout';
import ModelPicker from './ModelPicker';
import { Pill, Tag } from './controls/Pill';

const ROW_ICON = 'size-[18px] shrink-0 text-muted-foreground';
/** The server's fallbacks (settings/app-config.ts) when neither Beheer nor .env picks a model */
const DEFAULTS: Record<AiSlot, string> = {
  ocr: 'gemini-3.8-flash',
  summary: 'gemini-3.8-flash',
  split: 'gemini-3.8-flash',
  chat: 'gemini-3.8-flash',
  tools: 'gemini-3.8-flash',
  prediction: 'gemini-pro-latest',
  deep: 'gemini-pro-latest',
};
const SLOT_INFO: Record<AiSlot, { icon: ComponentType<{ className?: string }>; title: string; meta: string }> = {
  ocr: { icon: CameraIcon, title: 'Foto OCR', meta: "Leest code + tijd van de sticker op hunt-foto's" },
  summary: { icon: FileTextIcon, title: 'Artikel-samenvattingen', meta: 'Korte samenvatting bij elk nieuwsbericht' },
  split: { icon: ListTreeIcon, title: 'Hint splitsen', meta: 'Splitst een hint in losse deelgebied-delen' },
  prediction: { icon: RadarIcon, title: 'Vos-voorspelling', meta: 'Voorspelt bij elke hint waar de vos zit' },
  chat: { icon: MessageCircleIcon, title: 'Intel-chat', meta: 'Gewone antwoorden in de chat' },
  deep: { icon: BrainIcon, title: 'Chat "Denk diep"', meta: 'Als je Denk diep aanzet' },
  tools: { icon: WrenchIcon, title: 'Chat-hulpmiddelen', meta: 'Luchtfoto bekijken, web zoeken, code uitvoeren' },
};
const TEST_OK_MS = 3000;

/** Ghost "▶ Test" → spinner → "✓ 0,8 s" for 3 s; a failure shows the server's message as a toast. `compact`: no "Test" text (phones). */
function TestButton({ slot, compact }: { slot: AiSlot; compact?: boolean }) {
  const authHeader = useAuthHeader() || '';
  const [state, setState] = useState<'idle' | 'busy' | { ms: number }>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function run() {
    clearTimeout(timer.current);
    setState('busy');
    const result = await testAiSlot(slot, authHeader);
    if (result.ok) {
      setState({ ms: result.ms });
      timer.current = setTimeout(() => setState('idle'), TEST_OK_MS);
    } else {
      toast.error(`${SLOT_INFO[slot].title}: ${result.error}`);
      setState('idle');
    }
  }

  const key = typeof state === 'object' ? 'ok' : state;
  return (
    <Pill
      variant="ghost"
      morphKey={key}
      className={cn(key === 'ok' && 'text-green-700 hover:text-green-700 dark:text-green-300 dark:hover:text-green-300')}
      disabled={state === 'busy'}
      onClick={() => void run()}
      aria-label={`Test ${SLOT_INFO[slot].title}`}
    >
      {key === 'busy' ? <Loader2Icon className="animate-spin" /> : key === 'ok' ? <CheckIcon /> : <PlayIcon />}
      {typeof state === 'object' ? `${(state.ms / 1000).toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s` : key === 'busy' || compact ? null : 'Test'}
    </Pill>
  );
}

/** Beheer → AI (A1): the Gemini key and which model each feature uses. */
export default function AiPane() {
  const admin = useAdminConfig();
  const config = admin.config;
  const key = config?.secrets.geminiApiKey;
  const list = useAiModels(!!key?.set);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const isMobile = useIsMobile();

  function closeEditor() {
    setEditing(false);
    setDraft('');
  }

  async function saveKey() {
    setSaving(true);
    try {
      await admin.saveSecret('geminiApiKey', draft.trim());
      closeEditor();
      toast.success('Gemini-sleutel opgeslagen');
      void list.revalidate();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Opslaan is mislukt.'));
    } finally {
      setSaving(false);
    }
  }

  async function clearKey() {
    try {
      await admin.clearSecret('geminiApiKey');
      closeEditor();
      toast.success('Gemini-sleutel gewist');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Wissen is mislukt.'));
    }
  }

  async function pick(slot: AiSlot, id: string) {
    try {
      // Picking the fallback stores nothing, so a later change of the server default carries through
      await admin.saveModels({ [slot]: id === DEFAULTS[slot] ? null : id });
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Model opslaan is mislukt.'));
    }
  }

  async function resetModels() {
    try {
      await admin.saveModels(Object.fromEntries(AI_SLOTS.map((slot) => [slot, null])));
      toast.success('Standaardmodellen hersteld');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Herstellen is mislukt.'));
    }
  }

  if (!config) {
    return (
      <BeheerPane title="AI" description="Gemini-sleutel en welk model wat doet.">
        {admin.isError ? <p className="text-sm text-muted-foreground">De instellingen konden niet worden geladen.</p> : <BeheerSkeleton groups={2} />}
      </BeheerPane>
    );
  }

  const statusKey = !key?.set ? 'none' : list.keyRejected ? 'rejected' : `${key.source}-${list.models ? list.models.length : 'loading'}`;
  const status = (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span key={statusKey} {...POP} className="flex shrink-0 gap-1.5">
        {!key?.set ? (
          <Tag>Geen sleutel</Tag>
        ) : list.keyRejected ? (
          <Tag tone="warn">Sleutel geweigerd</Tag>
        ) : (
          <>
            {key.source === 'env' && <Tag tone="info">Uit .env</Tag>}
            {list.models && (
              <Tag tone="ok">
                <CheckIcon />
                Werkt · {list.models.length} modellen
              </Tag>
            )}
          </>
        )}
      </motion.span>
    </AnimatePresence>
  );
  const modelsFromEnv = AI_SLOTS.some((slot) => config.ai[slot].source === 'env');
  const hasCustomModels = AI_SLOTS.some((slot) => config.ai[slot].source === 'db');

  return (
    <BeheerPane title="AI" description="Gemini-sleutel en welk model wat doet.">
      <BeheerCard title="Gemini-sleutel" description="Van aistudio.google.com. Versleuteld opgeslagen." right={status}>
        <BeheerRows>
          <BeheerRow
            key="key"
            leading={<KeyRoundIcon className={ROW_ICON} />}
            title={
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={key?.set ? (key.hint ?? 'set') : 'none'} {...SWAP} className={key?.set ? 'font-mono tracking-wide' : 'font-normal text-muted-foreground'}>
                  {key?.set ? key.hint : 'Nog niet ingesteld — AI staat uit'}
                </motion.span>
              </AnimatePresence>
            }
            meta={key?.source === 'env' ? 'Opslaan hier gaat vóór de .env-waarde.' : undefined}
          >
            <Pill variant={key?.set ? 'secondary' : 'primary'} morphKey={key?.set ? 'edit' : 'add'} disabled={!config.settingsKeyOk} onClick={() => (editing ? closeEditor() : setEditing(true))}>
              {key?.set ? 'Wijzigen' : 'Sleutel toevoegen'}
            </Pill>
            <AnimatePresence initial={false}>
              {key?.source === 'db' && (
                <motion.span key="clear" {...POP}>
                  <Pill variant="ghost" onClick={() => void clearKey()}>
                    Wissen
                  </Pill>
                </motion.span>
              )}
            </AnimatePresence>
          </BeheerRow>
        </BeheerRows>
        <Reveal>
          {editing && (
            <form
              className="flex flex-wrap gap-2 pt-2.5"
              onSubmit={(event) => {
                event.preventDefault();
                if (draft.trim() && !saving) void saveKey();
              }}
            >
              <Input
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.stopPropagation();
                    closeEditor();
                  }
                }}
                placeholder="AIza…"
                aria-label="Nieuwe Gemini-sleutel"
                className="h-9 min-w-48 flex-1 basis-48 rounded-xl border-0 bg-beheer-row font-mono text-[13px]"
                autoComplete="off"
                spellCheck={false}
              />
              <Pill variant="secondary" size="md" onClick={closeEditor}>
                Annuleer
              </Pill>
              <Pill type="submit" variant="primary" size="md" disabled={!draft.trim() || saving} morphKey={saving ? 'busy' : 'idle'}>
                {saving && <Loader2Icon className="animate-spin" />}
                Opslaan
              </Pill>
            </form>
          )}
        </Reveal>
        <AnimatePresence initial={false}>
          {!config.settingsKeyOk && <WarnBar key="nokey">SETTINGS_KEY ontbreekt op de server: de sleutel kan hier niet worden opgeslagen.</WarnBar>}
          {key?.undecryptable && <WarnBar key="undecryptable">De opgeslagen sleutel kan niet worden ontsleuteld (andere SETTINGS_KEY). Voer hem opnieuw in.</WarnBar>}
          {list.keyRejected && <WarnBar key="rejected">Google weigert deze sleutel. AI-functies staan stil.</WarnBar>}
        </AnimatePresence>
      </BeheerCard>

      <BeheerCard
        title="Modellen"
        description="Welk Gemini-model elke functie gebruikt."
        right={
          <span className="flex shrink-0 items-center gap-1.5">
            <AnimatePresence initial={false}>
              {modelsFromEnv && (
                <motion.span key="env" {...POP}>
                  <Tag tone="info">Uit .env</Tag>
                </motion.span>
              )}
            </AnimatePresence>
            <Pill variant="ghost" disabled={!key?.set || !hasCustomModels} onClick={() => void resetModels()}>
              Standaard herstellen
            </Pill>
          </span>
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          {key?.set ? (
            <motion.div key="rows" {...SWAP}>
              <BeheerRows>
                {AI_SLOTS.map((slot) => {
                  const info = SLOT_INFO[slot];
                  const Icon = info.icon;
                  const picker = (
                    <ModelPicker
                      label={info.title}
                      value={config.ai[slot].value}
                      defaultId={DEFAULTS[slot]}
                      models={list.models}
                      fetchedAt={list.fetchedAt}
                      listError={list.error}
                      onRefresh={list.refresh}
                      onChange={(id) => void pick(slot, id)}
                      className={isMobile ? 'w-auto min-w-0 flex-1' : undefined}
                    />
                  );
                  // Phones: the controls get their own full-width line under the text
                  return isMobile ? (
                    <BeheerRow
                      key={slot}
                      leading={<Icon className={ROW_ICON} />}
                      title={info.title}
                      meta={info.meta}
                      below={
                        <>
                          <TestButton slot={slot} compact />
                          {picker}
                        </>
                      }
                    />
                  ) : (
                    <BeheerRow key={slot} leading={<Icon className={ROW_ICON} />} title={info.title} meta={info.meta}>
                      <TestButton slot={slot} />
                      {picker}
                    </BeheerRow>
                  );
                })}
              </BeheerRows>
            </motion.div>
          ) : (
            <motion.p key="nokey" {...SWAP} className="rounded-2xl bg-beheer-row px-3 py-2.5 text-[12.5px] text-muted-foreground">
              Voeg eerst een sleutel toe; dan haalt de lijst de modellen op.
            </motion.p>
          )}
        </AnimatePresence>
      </BeheerCard>
    </BeheerPane>
  );
}
