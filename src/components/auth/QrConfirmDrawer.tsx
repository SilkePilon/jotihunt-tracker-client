import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { KeyRoundIcon, XIcon } from 'lucide-react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import HoldButton from '@/components/auth/HoldButton';
import QrLinkIllustration from '@/components/auth/QrLinkIllustration';
import SuccessBadge from '@/components/auth/SuccessBadge';
import { useMarkerPalette } from '@/components/layers/marker-icons';
import AutoHeight from '@/components/motion/AutoHeight';
import Reveal from '@/components/motion/Reveal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/auth.hook';
import { useNow } from '@/hooks/now.hook';
import { addPasskey, approveQrLogin, denyQrLogin, scanQrLogin, type QrScan } from '@/lib/auth-api';
import { BADGE_COOKIE_DEPTH, cookiePath } from '@/lib/cookie-shape';
import { joinParts } from '@/lib/format';
import { classifyPasskeyError, PASSKEY_MESSAGES } from '@/lib/passkey';
import { canRetryConfirm, qrProblem, type QrProblem } from '@/lib/qr-login';
import { fadeUp, POP, SWAP } from '@/lib/motion';
import { formatLastUpdate } from '@/lib/tracker';
import type { User } from '@/types/User';

type View =
  | { step: 'loading' }
  | { step: 'ready'; scan: QrScan; busy: boolean; error: string | null }
  | { step: 'done'; label: string }
  | { step: 'problem'; problem: QrProblem };

/** Long enough for the check to pop and draw and the text to be read; "Naar de kaart" closes sooner */
const AUTO_CLOSE_MS = 1800;

/** 48 px, rounded-xl like Beheer */
const PRIMARY = 'h-12 w-full rounded-xl text-[14.5px] font-semibold';
const SECONDARY = 'h-12 w-full rounded-xl bg-beheer-row-high text-[14.5px] font-semibold text-foreground hover:bg-beheer-row-high/70';

const BADGE = 48;

/** "{where} · als {name}", dropping whatever is missing */
function ReadyMeta({ where, name }: { where: string; name: string | undefined }) {
  if (!where && !name) return null;
  return (
    <p className="text-[13.5px] text-muted-foreground">
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

  function close() {
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

  async function confirm(scan: QrScan) {
    if (!authHeader || closing.current) return;
    setView({ step: 'ready', scan, busy: true, error: null });
    try {
      await approveQrLogin(code, scan, authHeader);
      setView({ step: 'done', label: scan.requester.label });
    } catch (failure) {
      // Cancelled the prompt or a passkey that did not match: the code still waits, so stay and let them try again
      if (canRetryConfirm(failure)) setView({ step: 'ready', scan, busy: false, error: PASSKEY_MESSAGES[classifyPasskeyError(failure)] });
      else setView({ step: 'problem', problem: qrProblem(failure) });
    }
  }

  // Close right away and deny in the background, so a double tap can not deny twice
  function refuse() {
    if (closing.current) return;
    close();
    toast('Inloggen geweigerd');
    if (authHeader) void denyQrLogin(code, authHeader).catch(() => undefined);
  }

  async function handleAddPasskey() {
    if (!authHeader) return;
    try {
      await updateUserState(await addPasskey(authHeader));
      toast.success('Passkey toegevoegd', { description: 'Scan de code op het andere apparaat opnieuw.' });
      close();
    } catch (failure) {
      toast.error(PASSKEY_MESSAGES[classifyPasskeyError(failure)]);
    }
  }

  return (
    <ResponsiveDialog open={open} onClose={close} onClosed={onClose} title="Inloggen op een ander apparaat?" description="Bevestig met je passkey." hideHeader compact className="sm:max-w-md">
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
              <h2 className="text-[19px] leading-[1.25] font-bold">Inloggen op {view.scan.requester.label}?</h2>
              <ReadyMeta where={joinParts(view.scan.requester.location, formatLastUpdate(view.scan.createdAt, now))} name={user?.name} />
              <Reveal>
                {view.error && (
                  <p role="alert" className="pt-3 text-xs font-medium text-destructive">
                    {view.error}
                  </p>
                )}
              </Reveal>
              <div className="mt-[18px] flex flex-col gap-2">
                <HoldButton
                  onConfirm={() => confirm(view.scan)}
                  busy={view.busy}
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
                <Button variant="secondary" className={SECONDARY} onClick={refuse} disabled={view.busy}>
                  Nee, dat ben ik niet
                </Button>
              </div>
            </motion.div>
          )}

          {view.step === 'done' && (
            <motion.div key="done" className="flex flex-col items-center gap-3 py-4 text-center" {...SWAP}>
              <SuccessBadge size={72} />
              <motion.h2 className="text-lg font-bold" {...fadeUp(0.2)}>
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
                  <h2 className="text-[17px] font-bold">Dat lukte niet</h2>
                  <p className="text-[13px] text-muted-foreground">{view.problem.message}</p>
                </div>
              </div>
              <div className="mt-1 flex flex-col gap-2">
                {view.problem.addPasskey ? (
                  <Button className={PRIMARY} onClick={handleAddPasskey}>
                    <KeyRoundIcon className="size-5" />
                    Passkey toevoegen
                  </Button>
                ) : null}
                <Button variant="secondary" className={SECONDARY} onClick={close}>
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
