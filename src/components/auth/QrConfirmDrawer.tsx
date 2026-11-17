import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { KeyRoundIcon, RefreshCwIcon, XIcon } from 'lucide-react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import HoldButton from '@/components/auth/HoldButton';
import QrLinkIllustration from '@/components/auth/QrLinkIllustration';
import SuccessBadge from '@/components/auth/SuccessBadge';
import { useMarkerPalette } from '@/components/layers/marker-icons';
import AutoHeight from '@/components/motion/AutoHeight';
import BusyIcon from '@/components/motion/BusyIcon';
import Reveal from '@/components/motion/Reveal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/auth.hook';
import { useNow } from '@/hooks/now.hook';
import { busyProps } from '@/lib/busy';
import { addPasskey, approveQrLogin, denyQrLogin, scanQrLogin, type QrScan } from '@/lib/auth-api';
import { TONAL_HOVER } from '@/lib/tonal-button';
import { BADGE_COOKIE_DEPTH, cookiePath } from '@/lib/cookie-shape';
import { DIALOG_SHELL } from '@/lib/dialog-shell';
import { joinParts } from '@/lib/format';
import { classifyPasskeyError, PASSKEY_MESSAGES } from '@/lib/passkey';
import { canRetryConfirm, denyFailure, qrProblem, type QrProblem } from '@/lib/qr-login';
import { fadeUp, POP, SWAP } from '@/lib/motion';
import { formatLastUpdate } from '@/lib/tracker';
import { cn } from '@/lib/utils';
import type { User } from '@/types/User';

type View =
  | { step: 'loading' }
  | { step: 'ready'; scan: QrScan; busy: false | 'approve' | 'deny'; error: string | null }
  | { step: 'done'; label: string }
  | { step: 'problem'; problem: QrProblem };

/** Long enough for the check to pop and draw and the text to be read; "Naar de kaart" closes sooner */
const AUTO_CLOSE_MS = 1800;

/** 48 px, rounded-xl like Beheer */
const PRIMARY = 'h-12 w-full rounded-xl text-[15px] font-semibold';
const SECONDARY = `h-12 w-full rounded-xl bg-beheer-row-high text-[15px] font-semibold text-foreground ${TONAL_HOVER}`;

const BADGE = 48;

/**
 * Ref for each step's title: it takes focus as it comes in (the buttons that held it went away with the old step), and
 * tells a screen-reader user what happened (Bevestigd, Dat lukte niet). Module-level, so re-renders don't re-run it.
 */
const focusTitle = (title: HTMLHeadingElement | null) => title?.focus({ preventScroll: true });

/** "{where} · als {name}", dropping whatever is missing */
function ReadyMeta({ where, name }: { where: string; name: string | undefined }) {
  if (!where && !name) return null;
  return (
    <p className="text-body text-muted-foreground">
      {where}
      {where && name ? ' · ' : null}
      {name ? (
        <>
          als <b className="text-foreground">{name}</b>
        </>
      ) : null}
    </p>
  );
}

/** errorContainer cookie with an X, like the hunt-rejected markers */
function ProblemBadge() {
  const palette = useMarkerPalette();
  const path = useMemo(() => cookiePath(BADGE, BADGE_COOKIE_DEPTH), []);
  return (
    <motion.span aria-hidden className="relative grid shrink-0 place-items-center" style={{ width: BADGE, height: BADGE }} {...POP}>
      <svg width={BADGE} height={BADGE} viewBox={`0 0 ${BADGE} ${BADGE}`} className="absolute inset-0">
        <path d={path} fill={palette.errorContainer} />
      </svg>
      <XIcon className="relative size-6" strokeWidth={2.5} color={palette.onErrorContainer} />
    </motion.span>
  );
}

/**
 * Phone: someone shows this account's QR code on a laptop; confirm with a passkey (a grabbed, unlocked phone can not).
 * `onClose` runs once the drawer has slid out; the parent unmounts it then.
 */
export default function QrConfirmDrawer({ code, onClose }: { code: string; onClose: () => void }) {
  const authHeader = useAuthHeader();
  const user = useAuthUser<User>();
  const { updateUserState } = useAuth();
  const [view, setView] = useState<View>({ step: 'loading' });
  const now = useNow(view.step === 'ready');
  const [open, setOpen] = useState(true);
  // A ref, not the state: a quick double tap on "Nee" must not deny twice while the drawer slides out
  const closing = useRef(false);
  // Also a ref: Esc, swipe and Back read it synchronously while a passkey prompt or the deny request runs
  const busy = useRef(false);
  const [adding, setAdding] = useState(false);
  // "Opnieuw proberen" after no answer: scanning the code again (the server lets the same account re-scan it)
  const [rescanning, setRescanning] = useState(false);

  function close() {
    // While approving or denying, Esc, the backdrop, swiping down and Back leave the drawer open until it settles
    if (busy.current) return;
    closing.current = true;
    setOpen(false);
  }

  useEffect(() => {
    if (view.step !== 'done') return;
    const timer = setTimeout(close, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [view.step]);

  useEffect(() => {
    if (!authHeader) return;
    let cancelled = false;
    scanQrLogin(code, authHeader)
      .then((scan) => !cancelled && setView({ step: 'ready', scan, busy: false, error: null }))
      .catch((failure) => !cancelled && setView({ step: 'problem', problem: qrProblem(failure) }));
    return () => {
      cancelled = true;
    };
  }, [code, authHeader]);

  async function rescan() {
    if (!authHeader || closing.current || rescanning) return;
    setRescanning(true);
    try {
      const scan = await scanQrLogin(code, authHeader);
      if (!closing.current) setView({ step: 'ready', scan, busy: false, error: null });
    } catch (failure) {
      if (!closing.current) setView({ step: 'problem', problem: qrProblem(failure) });
    } finally {
      setRescanning(false);
    }
  }

  async function confirm(scan: QrScan) {
    if (!authHeader || closing.current || busy.current) return;
    busy.current = true;
    setView({ step: 'ready', scan, busy: 'approve', error: null });
    try {
      await approveQrLogin(code, scan, authHeader);
      busy.current = false;
      setView({ step: 'done', label: scan.requester.label });
    } catch (failure) {
      busy.current = false;
      // Cancelled the prompt or a passkey that did not match: the code still waits, so stay and let them try again
      if (canRetryConfirm(failure)) setView({ step: 'ready', scan, busy: false, error: PASSKEY_MESSAGES[classifyPasskeyError(failure)] });
      else setView({ step: 'problem', problem: qrProblem(failure) });
    }
  }

  // Only says "geweigerd" once the server has it; on failure the drawer stays with the error so they can try again
  async function refuse(scan: QrScan) {
    if (!authHeader || closing.current || busy.current) return;
    busy.current = true;
    setView({ step: 'ready', scan, busy: 'deny', error: null });
    try {
      await denyQrLogin(code, authHeader);
      busy.current = false;
      toast('Inloggen geweigerd');
      close();
    } catch (failure) {
      busy.current = false;
      const outcome = denyFailure(failure);
      if ('retry' in outcome) setView({ step: 'ready', scan, busy: false, error: outcome.retry });
      else setView({ step: 'problem', problem: outcome.problem });
    }
  }

  async function handleAddPasskey() {
    if (!authHeader || busy.current) return;
    busy.current = true;
    setAdding(true);
    try {
      await updateUserState(await addPasskey(authHeader));
      busy.current = false;
      toast.success('Passkey toegevoegd', { description: 'Scan de code op het andere apparaat opnieuw.' });
      close();
    } catch (failure) {
      busy.current = false;
      toast.error(PASSKEY_MESSAGES[classifyPasskeyError(failure)]);
    } finally {
      setAdding(false);
    }
  }

  return (
    <ResponsiveDialog backEntry={false} open={open} onClose={close} onClosed={onClose} title="Inloggen op een ander apparaat?" description="Bevestig met je passkey." hideHeader compact className={cn(DIALOG_SHELL, 'bg-card p-5 sm:max-w-md')} drawerClassName="bg-card">
      {/* The drawer grows/shrinks with the step; the padding keeps focus rings out of the clip */}
      <AutoHeight scene={view.step} className="-mx-1 -mt-1" innerClassName="px-1 pt-1 pb-2">
        <AnimatePresence mode="wait" initial={false}>
          {view.step === 'loading' && (
            <motion.div key="loading" className="flex flex-col" {...SWAP}>
              <QrLinkIllustration animated={false} />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/2" />
            </motion.div>
          )}

          {view.step === 'ready' && (
            <motion.div key="ready" className="flex flex-col" {...SWAP}>
              <QrLinkIllustration />
              <h2 ref={focusTitle} tabIndex={-1} className="text-lg leading-[1.25] font-bold outline-none">Inloggen op {view.scan.requester.label}?</h2>
              <ReadyMeta where={joinParts(view.scan.requester.location, formatLastUpdate(view.scan.createdAt, now))} name={user?.name} />
              <Reveal>
                {view.error && (
                  <p role="alert" className="pt-3 text-xs font-medium text-destructive-text">
                    {view.error}
                  </p>
                )}
              </Reveal>
              <div className="mt-[18px] flex flex-col gap-2">
                <HoldButton
                  onConfirm={() => confirm(view.scan)}
                  busy={view.busy === 'approve'}
                  disabled={view.busy === 'deny'}
                  busyLabel="Wachten op passkey…"
                  releaseLabel={
                    <>
                      <KeyRoundIcon />
                      Laat los om te bevestigen
                    </>
                  }
                  aria-label="Houd vast om te bevestigen"
                >
                  <KeyRoundIcon />
                  Houd vast om te bevestigen
                </HoldButton>
                <Button variant="secondary" className={cn(SECONDARY, view.busy === 'deny' && 'disabled:opacity-100')} onClick={() => void refuse(view.scan)} disabled={view.busy !== false} aria-busy={view.busy === 'deny'}>
                  <BusyIcon busy={view.busy === 'deny'} />
                  {view.busy === 'deny' ? 'Weigeren…' : 'Nee, dat ben ik niet'}
                </Button>
              </div>
            </motion.div>
          )}

          {view.step === 'done' && (
            <motion.div key="done" className="flex flex-col items-center gap-3 py-4 text-center" {...SWAP}>
              <SuccessBadge size={72} />
              <motion.h2 ref={focusTitle} tabIndex={-1} className="text-lg font-bold outline-none" {...fadeUp(0.2)}>
                Bevestigd
              </motion.h2>
              <motion.p className="text-sm text-muted-foreground" {...fadeUp(0.3)}>
                {view.label} kan nu inloggen als {user?.name}.
              </motion.p>
              <motion.div className="w-full" {...fadeUp(0.4)}>
                <Button className={PRIMARY} onClick={close}>
                  Naar de kaart
                </Button>
              </motion.div>
            </motion.div>
          )}

          {view.step === 'problem' && (
            <motion.div key="problem" className="flex flex-col gap-3" {...SWAP}>
              <div className="flex items-center gap-3">
                <ProblemBadge />
                <div className="min-w-0">
                  <h2 ref={focusTitle} tabIndex={-1} className="text-lg font-bold outline-none">
                    Dat lukte niet
                  </h2>
                  <p className="text-body text-muted-foreground">{view.problem.message}</p>
                </div>
              </div>
              <div className="mt-1 flex flex-col gap-2">
                {view.problem.addPasskey ? (
                  <Button className={cn(PRIMARY, adding && 'disabled:opacity-100')} onClick={() => void handleAddPasskey()} disabled={adding} aria-busy={adding}>
                    <BusyIcon busy={adding} icon={<KeyRoundIcon className="size-5" />} />
                    Passkey toevoegen
                  </Button>
                ) : view.problem.retry ? (
                  // No answer: the code may still wait, so trying again leads (back to the confirm view once it answers)
                  // Busy: aria-disabled keeps the focus on it (the spinner stays at full strength)
                  <Button className={cn(PRIMARY, rescanning && 'aria-disabled:opacity-100')} onClick={() => void rescan()} {...busyProps(rescanning)}>
                    <BusyIcon busy={rescanning} icon={<RefreshCwIcon className="size-5" />} />
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span key={rescanning ? 'busy' : 'idle'} {...SWAP}>
                        {rescanning ? 'Opnieuw proberen…' : 'Opnieuw proberen'}
                      </motion.span>
                    </AnimatePresence>
                  </Button>
                ) : null}
                <Button variant="secondary" className={SECONDARY} onClick={close} disabled={adding || rescanning}>
                  Sluiten
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </AutoHeight>
    </ResponsiveDialog>
  );
}
