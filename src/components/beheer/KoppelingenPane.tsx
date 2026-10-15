import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckIcon, LinkIcon, Loader2Icon, RefreshCwIcon, TriangleAlertIcon, UnlinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { MapRef } from '@/components/Map';
import JotiboardLoginForm from '@/components/cards/jotiboard/JotiboardLoginForm';
import JotiboardLogo from '@/components/cards/jotiboard/JotiboardLogo';
import Life360LinkPanel, { type Life360LinkView } from '@/components/cards/life360/Life360LinkPanel';
import Life360Logo from '@/components/cards/life360/Life360Logo';
import TelegramLinkPanel from '@/components/cards/telegram/TelegramLinkPanel';
import TelegramLogo from '@/components/cards/telegram/TelegramLogo';
import Reveal from '@/components/motion/Reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { useJotiboardAdmin } from '@/hooks/jotiboard.hook';
import { useLife360Admin } from '@/hooks/life360.hook';
import { useNow } from '@/hooks/now.hook';
import { revalidateTelegramViews, useTelegramAdmin } from '@/hooks/telegram.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { JOTIBOARD_SLATE } from '@/lib/jotiboard';
import { jotiboardIntegration, life360Integration, telegramIntegration, type IntegrationTone, type IntegrationView } from '@/lib/koppelingen';
import { LIFE360_PURPLE, refreshAllowed } from '@/lib/life360';
import { POP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { Life360LinkedStatus } from '@/types/Life360';
import { BeheerCard, BeheerPane, FadeSwap, InlineConfirm } from './BeheerLayout';
import BuildingsCard from './BuildingsCard';
import { IconPill, Pill, Tag } from './controls/Pill';

/** Telegram's brand blue (as TELEGRAM_BUTTON in TelegramLinkPanel) */
const TELEGRAM_BLUE = '#229ED9';
/** The inline confirm sits in the card as a red box */
const CONFIRM_BOX = 'rounded-[18px] bg-destructive/12 px-3.5 py-3';

const TAG_TONE: Record<IntegrationTone, 'ok' | 'neutral' | 'warn'> = { ok: 'ok', off: 'neutral', warn: 'warn' };

/** Runs `action`; null when it succeeded, else the server's (Dutch) error text (as in Life360Section). */
async function errorText(action: () => Promise<unknown>, fallback: string): Promise<string | null> {
  try {
    await action();
    return null;
  } catch (error) {
    return apiErrorMessage(error, fallback);
  }
}

/** Calls `onLinked` when `state` turns 'linked' from one of the link steps (not e.g. paused → linked). */
function useLinkedTransition(state: string | undefined, steps: string[], onLinked: () => void) {
  const previous = useRef(state);
  // The latest callback, so the effect only runs when the state changes
  const onLinkedRef = useRef(onLinked);
  useEffect(() => {
    onLinkedRef.current = onLinked;
  });
  useEffect(() => {
    if (state === 'linked' && previous.current && steps.includes(previous.current)) onLinkedRef.current();
    previous.current = state;
  }, [state, steps]);
}

const TELEGRAM_STEPS = ['qr', 'password'];
// A token links straight from unlinked / loggedOut, without the code and circle steps
const LIFE360_STEPS = ['code', 'circle', 'unlinked', 'loggedOut'];
// Jotiboard logs in straight from unlinked / loggedOut
const JOTIBOARD_STEPS = ['unlinked', 'loggedOut'];

/** Life360's "ververs": asks for fresh fixes (max 1 per minute); spins while it runs. */
function RefreshButton({ status, onRefresh }: { status: Life360LinkedStatus; onRefresh: () => Promise<void> }) {
  const now = useNow(true);
  const [refreshing, setRefreshing] = useState(false);
  const canRefresh = !refreshing && refreshAllowed(status.refreshAvailableAt, now);

  async function refresh() {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <IconPill className="size-[26px]" aria-label="Life360 verversen" disabled={!canRefresh} onClick={() => void refresh()}>
      <RefreshCwIcon className={cn('size-3.5', refreshing && 'animate-spin')} />
    </IconPill>
  );
}

interface IntegrationCardProps {
  name: string;
  /** Fill of the logo circle */
  brand: string;
  logo: ReactNode;
  view: IntegrationView | undefined;
  isError: boolean;
  /** Koppelen / Ontkoppelen (null for none) and a key that changes with it */
  action: ReactNode;
  actionKey: string;
  /** After the sync line, e.g. the refresh button */
  syncAction?: ReactNode;
  onRelink?: () => void;
  /** The inline confirm while asking to unlink */
  confirm?: ReactNode;
  /** The link steps while linking */
  panel?: ReactNode;
}

/** K1: one card per integration — logo, name + status pill, "gekoppeld als …", sync line, amber problem bar, confirm, link steps. */
function IntegrationCard({ name, brand, logo, view, isError, action, actionKey, syncAction, onRelink, confirm, panel }: IntegrationCardProps) {
  return (
    <BeheerCard>
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full text-white" style={{ background: brand }}>
          {logo}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-bold">{name}</h3>
            <AnimatePresence mode="popLayout" initial={false}>
              {view && (
                <motion.span key={view.pill} className="inline-flex" {...POP}>
                  <Tag tone={TAG_TONE[view.tone]}>
                    {view.tone === 'ok' && <CheckIcon />}
                    {view.tone === 'warn' && <TriangleAlertIcon />}
                    {view.pill}
                  </Tag>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <FadeSwap className="text-[12.5px] text-muted-foreground">{view ? view.line : isError ? 'Status ophalen is mislukt.' : <Skeleton className="mt-1 h-3 w-40" />}</FadeSwap>
        </div>
        <AnimatePresence mode="popLayout" initial={false}>
          {action && (
            <motion.div key={actionKey} className="shrink-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              {action}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Reveal>
        {view?.sync && (
          // Lined up with the text (44px logo + 12px gap)
          <div className="flex items-center gap-1 pt-1.5 pl-14 text-xs text-muted-foreground">
            <span className="tabular-nums">{view.sync}</span>
            {syncAction}
          </div>
        )}
      </Reveal>
      <Reveal>
        {view?.problem && (
          <div className="pt-3">
            <div className="flex flex-wrap items-center gap-2.5 rounded-2xl bg-amber-500/15 px-3 py-2.5 text-amber-800 dark:text-amber-200">
              <TriangleAlertIcon className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 basis-48 text-[12.5px]">{view.problem}</span>
              {view.canRelink && onRelink && (
                <Pill variant="warn" onClick={onRelink}>
                  Opnieuw koppelen
                </Pill>
              )}
            </div>
          </div>
        )}
      </Reveal>
      <Reveal>{confirm && <div className="pt-3">{confirm}</div>}</Reveal>
      <Reveal>
        {panel && (
          <div className="pt-3">
            <div className="rounded-[18px] bg-beheer-row p-4">{panel}</div>
          </div>
        )}
      </Reveal>
    </BeheerCard>
  );
}

/**
 * Beheer → Koppelingen (K1): the group's Telegram, Life360 and Jotiboard accounts, one card each ("Koppelen" unfolds the same steps
 * as the sidebar cards), and the 3D building cache.
 */
export default function KoppelingenPane({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const telegram = useTelegramAdmin(true);
  const life360 = useLife360Admin(true);
  const jotiboard = useJotiboardAdmin(true);
  const now = useNow(true);
  const [confirming, setConfirming] = useState<'telegram' | 'life360' | 'jotiboard' | null>(null);

  // Telegram: "Koppelen" starts the QR login; the panel shows while the server is in a link step
  const [telegramStarting, setTelegramStarting] = useState(false);
  const telegramState = telegram.status?.state;
  const telegramPanel = telegramState === 'qr' || telegramState === 'password';

  useLinkedTransition(telegramState, TELEGRAM_STEPS, () => {
    // The QR scan completes on the server: refresh the "linked" views too
    revalidateTelegramViews();
    toast.success('Telegram gekoppeld');
  });

  async function startTelegram() {
    setTelegramStarting(true);
    try {
      await telegram.link();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Koppelen starten is mislukt, probeer het opnieuw.'));
    } finally {
      setTelegramStarting(false);
    }
  }

  async function unlinkTelegram() {
    try {
      await telegram.unlink();
      setConfirming(null);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Ontkoppelen is mislukt, probeer het opnieuw.'));
    }
  }

  // Life360: "Koppelen" opens the e-mail step (local only, as in Life360Card); the server's code / circle steps follow
  const [emailStep, setEmailStep] = useState(false);
  const [emailPrefill, setEmailPrefill] = useState('');
  const life360Status = life360.status;
  const life360State = life360Status?.state;
  // Any server step change closes the e-mail step (a sent code moves on to the code step)
  const [previousLife360State, setPreviousLife360State] = useState(life360State);
  if (life360State !== previousLife360State) {
    setPreviousLife360State(life360State);
    setEmailStep(false);
  }
  const canLinkLife360 = life360State === 'unlinked' || life360State === 'loggedOut';
  const life360Step: Life360LinkView | null = emailStep && canLinkLife360 ? 'email' : life360State === 'code' || life360State === 'circle' ? life360State : null;

  useLinkedTransition(life360State, LIFE360_STEPS, () => toast.success('Life360 gekoppeld'));

  async function cancelLife360() {
    try {
      await life360.unlink();
      return true;
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Annuleren is mislukt, probeer het opnieuw.'));
      return false;
    }
  }

  /** "ander adres": cancel the pending login and reopen the e-mail step with the old address (as in Life360Card). */
  async function otherAddress() {
    const email = life360Status && 'email' in life360Status ? life360Status.email : undefined;
    if (!(await cancelLife360())) return;
    if (email !== undefined) setEmailPrefill(email);
    setEmailStep(true);
  }

  /** "Koppelen", and "Opnieuw koppelen" when logged out (starts from the address that was linked) */
  function openLife360() {
    if (life360Status?.state === 'loggedOut') setEmailPrefill(life360Status.email);
    setEmailStep(true);
  }

  async function unlinkLife360() {
    try {
      await life360.unlink();
      setConfirming(null);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Ontkoppelen is mislukt, probeer het opnieuw.'));
    }
  }

  async function refreshLife360() {
    try {
      await life360.requestFreshLocations();
      toast.success('Life360 vraagt nieuwe locaties op');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Verversen is mislukt, probeer het later opnieuw.'));
    }
  }

  // Jotiboard: "Koppelen" / "Opnieuw koppelen" opens the login form; any server state change closes it
  const [jotiboardForm, setJotiboardForm] = useState(false);
  const jotiboardState = jotiboard.status?.state;
  const [previousJotiboardState, setPreviousJotiboardState] = useState(jotiboardState);
  if (jotiboardState !== previousJotiboardState) {
    setPreviousJotiboardState(jotiboardState);
    setJotiboardForm(false);
  }

  useLinkedTransition(jotiboardState, JOTIBOARD_STEPS, () => toast.success('Jotiboard gekoppeld'));

  async function unlinkJotiboard() {
    try {
      await jotiboard.unlink();
      setConfirming(null);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Ontkoppelen is mislukt, probeer het opnieuw.'));
    }
  }

  const telegramView = telegram.status && telegramIntegration(telegram.status, now);
  const life360Card = life360Status && life360Integration(life360Status, now);
  const jotiboardCard = jotiboard.status && jotiboardIntegration(jotiboard.status, now);

  // The account was unlinked elsewhere (or got disconnected) while asking: drop the confirm so it doesn't come back
  // once the integration can be unlinked again
  const confirmStale =
    (confirming === 'telegram' && !telegramView?.canUnlink) ||
    (confirming === 'life360' && !life360Card?.canUnlink) ||
    (confirming === 'jotiboard' && !jotiboardCard?.canUnlink);
  if (confirmStale) setConfirming(null);

  let telegramAction: ReactNode = null;
  if (telegramView?.canUnlink) {
    telegramAction = (
      <Pill variant="danger-outline" disabled={confirming === 'telegram'} onClick={() => setConfirming('telegram')}>
        Ontkoppelen
      </Pill>
    );
  } else if (telegramView?.canLink) {
    telegramAction = (
      <Pill variant="primary" morphKey={telegramStarting ? 'busy' : 'idle'} disabled={telegramStarting} onClick={() => void startTelegram()}>
        {telegramStarting ? <Loader2Icon className="animate-spin" /> : <LinkIcon />}
        Koppelen
      </Pill>
    );
  }

  let life360Action: ReactNode = null;
  if (life360Card?.canUnlink) {
    life360Action = (
      <Pill variant="danger-outline" disabled={confirming === 'life360'} onClick={() => setConfirming('life360')}>
        Ontkoppelen
      </Pill>
    );
  } else if (life360Card?.canLink && !emailStep) {
    life360Action = (
      <Pill variant="primary" onClick={openLife360}>
        <LinkIcon />
        Koppelen
      </Pill>
    );
  }

  let jotiboardAction: ReactNode = null;
  if (jotiboardCard?.canUnlink) {
    jotiboardAction = (
      <Pill variant="danger-outline" disabled={confirming === 'jotiboard'} onClick={() => setConfirming('jotiboard')}>
        Ontkoppelen
      </Pill>
    );
  } else if (jotiboardCard?.canLink && !jotiboardForm) {
    jotiboardAction = (
      <Pill variant="primary" onClick={() => setJotiboardForm(true)}>
        <LinkIcon />
        Koppelen
      </Pill>
    );
  }

  return (
    <BeheerPane title="Koppelingen" description="Accounts en databronnen van de groep.">
      <IntegrationCard
        name="Telegram"
        brand={TELEGRAM_BLUE}
        logo={<TelegramLogo className="size-[22px]" />}
        view={telegramView}
        isError={telegram.isError}
        action={telegramAction}
        actionKey={telegramView?.canUnlink ? 'unlink' : 'link'}
        confirm={
          confirming === 'telegram' && telegramView?.canUnlink && (
            <InlineConfirm
              className={CONFIRM_BOX}
              title="Telegram ontkoppelen?"
              description="De server logt uit bij Telegram. Tegenhunts worden dan niet meer automatisch gemeld, tot iemand opnieuw koppelt."
              confirmLabel="Ontkoppel"
              confirmIcon={<UnlinkIcon />}
              onCancel={() => setConfirming(null)}
              onConfirm={unlinkTelegram}
            />
          )
        }
        panel={
          telegramPanel &&
          telegram.status && (
            <TelegramLinkPanel
              status={telegram.status}
              onLink={startTelegram}
              onCancel={async () => {
                try {
                  await telegram.unlink();
                } catch (error) {
                  toast.error(apiErrorMessage(error, 'Annuleren is mislukt, probeer het opnieuw.'));
                }
              }}
              onSubmitPassword={async (password) => {
                try {
                  await telegram.submitPassword(password);
                  return null;
                } catch (error) {
                  const message = apiErrorMessage(error, 'Koppelen is mislukt, probeer het opnieuw.');
                  // Also as a toast: when the login was cancelled (409) or failed (502), the next poll replaces this step
                  toast.error(message);
                  return message;
                }
              }}
            />
          )
        }
      />

      <IntegrationCard
        name="Life360"
        brand={LIFE360_PURPLE}
        logo={<Life360Logo className="size-[22px]" />}
        view={life360Card}
        isError={life360.isError}
        action={life360Action}
        actionKey={life360Card?.canUnlink ? 'unlink' : 'link'}
        syncAction={life360Status?.state === 'linked' && <RefreshButton status={life360Status} onRefresh={refreshLife360} />}
        onRelink={openLife360}
        confirm={
          confirming === 'life360' && life360Card?.canUnlink && (
            <InlineConfirm
              className={CONFIRM_BOX}
              title="Life360 ontkoppelen?"
              description="De server vergeet de Life360-sessie. De Life360-laag verdwijnt van de kaart, tot iemand opnieuw koppelt."
              confirmLabel="Ontkoppel"
              confirmIcon={<UnlinkIcon />}
              onCancel={() => setConfirming(null)}
              onConfirm={unlinkLife360}
            />
          )
        }
        panel={
          life360Step &&
          life360Status && (
            <Life360LinkPanel
              view={life360Step}
              status={life360Status}
              emailPrefill={emailPrefill}
              onOpenEmail={() => setEmailStep(true)}
              onCloseEmail={() => setEmailStep(false)}
              onOtherAddress={() => void otherAddress()}
              onSendCode={(email) => errorText(() => life360.sendCode(email), 'Code versturen is mislukt, probeer het opnieuw.')}
              onVerifyCode={(code) => errorText(() => life360.verifyCode(code), 'Koppelen is mislukt, probeer het opnieuw.')}
              onChooseCircle={(circleId) => errorText(() => life360.chooseCircle(circleId), 'Cirkel kiezen is mislukt, probeer het opnieuw.')}
              onSubmitToken={(token) => errorText(() => life360.submitToken(token), 'Koppelen met token is mislukt, probeer het opnieuw.')}
              onCancel={cancelLife360}
            />
          )
        }
      />

      <IntegrationCard
        name="Jotiboard"
        brand={JOTIBOARD_SLATE}
        logo={<JotiboardLogo className="size-[22px]" />}
        view={jotiboardCard}
        isError={jotiboard.isError}
        action={jotiboardAction}
        actionKey={jotiboardCard?.canUnlink ? 'unlink' : 'link'}
        // The server state doesn't change on relink (as Life360's does): hide "Opnieuw koppelen" while the form is open
        onRelink={jotiboardForm ? undefined : () => setJotiboardForm(true)}
        confirm={
          confirming === 'jotiboard' && jotiboardCard?.canUnlink && (
            <InlineConfirm
              className={CONFIRM_BOX}
              title="Jotiboard ontkoppelen?"
              description="De server vergeet de Jotiboard-sessie. Wat al geïmporteerd is blijft staan."
              confirmLabel="Ontkoppel"
              confirmIcon={<UnlinkIcon />}
              onCancel={() => setConfirming(null)}
              onConfirm={unlinkJotiboard}
            />
          )
        }
        panel={
          jotiboardForm &&
          jotiboard.status && (
            <JotiboardLoginForm
              fixedUsername={jotiboard.status.state === 'loggedOut' ? jotiboard.status.username : undefined}
              submitLabel={jotiboard.status.state === 'loggedOut' ? 'Opnieuw inloggen' : 'Koppelen'}
              onCancel={() => setJotiboardForm(false)}
              onSubmit={(username, password) => errorText(() => jotiboard.link(username, password), 'Koppelen is mislukt, probeer het opnieuw.')}
            />
          )
        }
      />

      <BuildingsCard mapRef={mapRef} />
    </BeheerPane>
  );
}
