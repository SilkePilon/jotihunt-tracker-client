import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { KeyRoundIcon, Loader2Icon, MapPinIcon, MonitorIcon, TriangleAlertIcon } from 'lucide-react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import SuccessBadge from '@/components/auth/SuccessBadge';
import AutoHeight from '@/components/motion/AutoHeight';
import Reveal from '@/components/motion/Reveal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/auth.hook';
import { useNow } from '@/hooks/now.hook';
import { addPasskey, approveQrLogin, denyQrLogin, scanQrLogin, type QrScan } from '@/lib/auth-api';
import { classifyPasskeyError, PASSKEY_MESSAGES } from '@/lib/passkey';
import { canRetryConfirm, qrProblem, type QrProblem } from '@/lib/qr-login';
import { fadeUp, SWAP } from '@/lib/motion';
import { formatLastUpdate } from '@/lib/tracker';
import type { User } from '@/types/User';

type View =
  | { step: 'loading' }
  | { step: 'ready'; scan: QrScan; busy: boolean; error: string | null }
  | { step: 'done'; label: string }
  | { step: 'problem'; problem: QrProblem };

/** Long enough for the check to pop and draw and the text to be read; "Naar de kaart" closes sooner */
const AUTO_CLOSE_MS = 1800;

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
    <ResponsiveDialog backEntry={false} open={open} onClose={close} onClosed={onClose} title="Inloggen op een ander apparaat?" description="Bevestig met je passkey." hideHeader compact className="sm:max-w-md">
      {/* The drawer grows/shrinks with the step; the padding keeps focus rings out of the clip */}
      <AutoHeight scene={view.step} className="-mx-1 -mt-1" innerClassName="px-1 pt-1 pb-2">
        <AnimatePresence mode="wait" initial={false}>
          {view.step === 'loading' && (
            <motion.div key="loading" className="flex flex-col gap-4" {...SWAP}>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-20 w-full" />
            </motion.div>
          )}

          {view.step === 'ready' && (
            <motion.div key="ready" className="flex flex-col gap-4" {...SWAP}>
              <div>
                <h2 className="text-lg font-semibold">Inloggen op een ander apparaat?</h2>
                <p className="text-sm text-muted-foreground">
                  Iemand wil inloggen als <b className="text-foreground">{user?.name}</b>.
                </p>
              </div>
              <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
                <div className="flex items-center gap-2">
                  <MonitorIcon className="size-4 text-muted-foreground" />
                  {view.scan.requester.label}
                </div>
                <div className="flex items-center gap-2">
                  <MapPinIcon className="size-4 text-muted-foreground" />
                  {[view.scan.requester.location, formatLastUpdate(view.scan.createdAt, now)].filter(Boolean).join(' · ')}
                </div>
              </div>
              <p className="flex gap-2 text-xs text-muted-foreground">
                <TriangleAlertIcon className="size-4 shrink-0 text-amber-500" />
                Alleen bevestigen als jij net zelf deze code scande.
              </p>
              <Reveal gap={16}>
                {view.error && (
                  <p role="alert" className="text-xs font-medium text-destructive">
                    {view.error}
                  </p>
                )}
              </Reveal>
              <div className="flex flex-col gap-2">
                <Button size="lg" className="w-full" onClick={() => confirm(view.scan)} disabled={view.busy}>
                  {view.busy ? <Loader2Icon className="animate-spin" /> : <KeyRoundIcon />}
                  Bevestigen met passkey
                </Button>
                <Button size="lg" variant="outline" className="w-full" onClick={refuse} disabled={view.busy}>
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
                <Button className="w-full" onClick={close}>
                  Naar de kaart
                </Button>
              </motion.div>
            </motion.div>
          )}

          {view.step === 'problem' && (
            <motion.div key="problem" className="flex flex-col gap-4" {...SWAP}>
              <div>
                <h2 className="text-lg font-semibold">Dat lukte niet</h2>
                <p className="text-sm text-muted-foreground">{view.problem.message}</p>
              </div>
              {view.problem.addPasskey ? (
                <Button className="w-full" onClick={handleAddPasskey}>
                  <KeyRoundIcon />
                  Passkey toevoegen
                </Button>
              ) : null}
              <Button variant="outline" className="w-full" onClick={close}>
                Sluiten
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </AutoHeight>
    </ResponsiveDialog>
  );
}
