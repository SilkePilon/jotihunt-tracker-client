import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import Life360LinkPanel, { type Life360LinkView } from '@/components/cards/life360/Life360LinkPanel';
import TelegramLinkPanel from '@/components/cards/telegram/TelegramLinkPanel';
import ConfirmDialog from '@/components/ConfirmDialog';
import Reveal from '@/components/motion/Reveal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useLife360Admin } from '@/hooks/life360.hook';
import { revalidateTelegramViews, useTelegramAdmin } from '@/hooks/telegram.hook';
import { apiErrorMessage } from '@/lib/api-error';
import type { Life360AdminStatus } from '@/types/Life360';
import type { TelegramAdminStatus } from '@/types/Telegram';
import { BeheerGroup, BeheerPane, BeheerRow } from './BeheerLayout';

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
  useEffect(() => {
    if (state === 'linked' && previous.current && steps.includes(previous.current)) onLinked();
    previous.current = state;
  }, [state, steps, onLinked]);
}

const TELEGRAM_STEPS = ['qr', 'password'];
const LIFE360_STEPS = ['code', 'circle'];

/** The trailing control of a row; fades when it changes (Koppelen ↔ Ontkoppelen ↔ nothing) */
function Trailing({ id, children }: { id: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {children ? (
        <motion.div key={id} className="shrink-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** The unfolded link steps under the group box */
function PanelBox({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border p-4 sm:max-w-sm">{children}</div>;
}

const metaSkeleton = <Skeleton className="mt-1 h-3 w-40" />;

function telegramMeta(status: TelegramAdminStatus | undefined, isError: boolean): ReactNode {
  if (!status) return isError ? 'Status ophalen is mislukt.' : metaSkeleton;
  const name = status.account?.name ?? 'Telegram';
  switch (status.state) {
    case 'unavailable':
      return 'Niet ingesteld op de server';
    case 'linked':
      return status.connected === false ? `Geen verbinding · ${name}` : `Gekoppeld via ${name} · leest @Jotihunt_bot`;
    case 'qr':
    case 'password':
      return 'Bezig met koppelen…';
    case 'unlinked':
      return 'Niet gekoppeld';
  }
}

function life360Meta(status: Life360AdminStatus | undefined, isError: boolean): ReactNode {
  if (!status) return isError ? 'Status ophalen is mislukt.' : metaSkeleton;
  switch (status.state) {
    case 'unavailable':
      return 'Niet ingesteld op de server';
    case 'linked':
      return `Gekoppeld via ${status.email}`;
    case 'paused':
      return 'Even gepauzeerd';
    case 'loggedOut':
      return 'Uitgelogd, opnieuw koppelen nodig';
    case 'code':
    case 'circle':
      return 'Bezig met koppelen…';
    case 'unlinked':
      return 'Niet gekoppeld';
  }
}

/** Beheer → Koppelingen: the group's Telegram and Life360 accounts. "Koppelen" unfolds the same steps as the sidebar cards. */
export default function KoppelingenPane() {
  const telegram = useTelegramAdmin(true);
  const life360 = useLife360Admin(true);

  // Telegram: "Koppelen" starts the QR login; the panel shows while the server is in a link step
  const [telegramStarting, setTelegramStarting] = useState(false);
  const [telegramConfirm, setTelegramConfirm] = useState(false);
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
      setTelegramConfirm(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Ontkoppelen is mislukt, probeer het opnieuw.'));
    }
  }

  // Life360: "Koppelen" opens the e-mail step (local only, as in Life360Card); the server's code / circle steps follow
  const [emailStep, setEmailStep] = useState(false);
  const [emailPrefill, setEmailPrefill] = useState('');
  const [life360Confirm, setLife360Confirm] = useState(false);
  const life360Status = life360.status;
  const life360State = life360Status?.state;
  // Any server step change closes the e-mail step (a sent code moves on to the code step)
  const [previousLife360State, setPreviousLife360State] = useState(life360State);
  if (life360State !== previousLife360State) {
    setPreviousLife360State(life360State);
    setEmailStep(false);
  }
  const canLinkLife360 = life360State === 'unlinked' || life360State === 'loggedOut';
  const life360View: Life360LinkView | null = emailStep && canLinkLife360 ? 'email' : life360State === 'code' || life360State === 'circle' ? life360State : null;

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

  function openLife360() {
    // Logged out: start from the address that was linked
    if (life360Status?.state === 'loggedOut') setEmailPrefill(life360Status.email);
    setEmailStep(true);
  }

  async function unlinkLife360() {
    try {
      await life360.unlink();
      setLife360Confirm(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Ontkoppelen is mislukt, probeer het opnieuw.'));
    }
  }

  let telegramTrailing: ReactNode = null;
  if (telegramState === 'linked') {
    telegramTrailing = (
      <Button variant="outline" size="sm" onClick={() => setTelegramConfirm(true)}>
        Ontkoppelen
      </Button>
    );
  } else if (telegramState === 'unlinked') {
    telegramTrailing = (
      <Button size="sm" disabled={telegramStarting} onClick={() => void startTelegram()}>
        {telegramStarting && <Loader2Icon className="animate-spin" />}
        Koppelen
      </Button>
    );
  }

  let life360Trailing: ReactNode = null;
  if (life360State === 'linked' || life360State === 'paused') {
    life360Trailing = (
      <Button variant="outline" size="sm" onClick={() => setLife360Confirm(true)}>
        Ontkoppelen
      </Button>
    );
  } else if (canLinkLife360 && !emailStep) {
    life360Trailing = (
      <Button size="sm" onClick={openLife360}>
        Koppelen
      </Button>
    );
  }

  return (
    <BeheerPane title="Koppelingen" description="Accounts van de groep.">
      <div>
        <BeheerGroup title="Accounts">
          <AnimatePresence initial={false}>
            <BeheerRow key="telegram" title="Telegram" meta={telegramMeta(telegram.status, telegram.isError)}>
              <Trailing id={telegramState === 'linked' ? 'unlink' : 'link'}>{telegramTrailing}</Trailing>
            </BeheerRow>
            <BeheerRow key="life360" title="Life360" meta={life360Meta(life360Status, life360.isError)}>
              <Trailing id={life360State === 'linked' || life360State === 'paused' ? 'unlink' : 'link'}>{life360Trailing}</Trailing>
            </BeheerRow>
          </AnimatePresence>
        </BeheerGroup>

        <Reveal>
          {telegramPanel && telegram.status && (
            <div className="pt-3">
              <PanelBox>
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
              </PanelBox>
            </div>
          )}
        </Reveal>

        <Reveal>
          {life360View && life360Status && (
            <div className="pt-3">
              <PanelBox>
                <Life360LinkPanel
                  view={life360View}
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
              </PanelBox>
            </div>
          )}
        </Reveal>
      </div>

      <ConfirmDialog
        open={telegramConfirm}
        onOpenChange={setTelegramConfirm}
        title="Telegram ontkoppelen?"
        description="De server logt uit bij Telegram. Tegenhunts worden dan niet meer automatisch gemeld, tot iemand opnieuw koppelt."
        confirmLabel="Ontkoppelen"
        destructive
        onConfirm={unlinkTelegram}
      />
      <ConfirmDialog
        open={life360Confirm}
        onOpenChange={setLife360Confirm}
        title="Life360 ontkoppelen?"
        description="De server vergeet de Life360-sessie. De Life360-laag verdwijnt van de kaart, tot iemand opnieuw koppelt."
        confirmLabel="Ontkoppelen"
        destructive
        onConfirm={unlinkLife360}
      />
    </BeheerPane>
  );
}
