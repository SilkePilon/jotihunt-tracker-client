import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { KeyRoundIcon, Loader2Icon, MapPinIcon, MonitorIcon, TriangleAlertIcon } from 'lucide-react';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import CookieBadge from '@/components/tracker/CookieBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/auth.hook';
import { useNow } from '@/hooks/now.hook';
import { addPasskey, approveQrLogin, denyQrLogin, scanQrLogin, type QrScan } from '@/lib/auth-api';
import { classifyPasskeyError, PASSKEY_MESSAGES } from '@/lib/passkey';
import { qrProblem, type QrProblem } from '@/lib/qr-login';
import { formatLastUpdate } from '@/lib/tracker';
import type { User } from '@/types/User';

type View =
  | { step: 'loading' }
  | { step: 'ready'; scan: QrScan; busy: boolean; error: string | null }
  | { step: 'done'; label: string }
  | { step: 'problem'; problem: QrProblem };

/** Phone: someone shows this account's QR code on a laptop; confirm with a passkey (a grabbed, unlocked phone can not). */
export default function QrConfirmDrawer({ code, onClose }: { code: string; onClose: () => void }) {
  const authHeader = useAuthHeader();
  const user = useAuthUser<User>();
  const { updateUserState } = useAuth();
  const [view, setView] = useState<View>({ step: 'loading' });
  const now = useNow(view.step === 'ready');

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
    if (!authHeader) return;
    setView({ step: 'ready', scan, busy: true, error: null });
    try {
      await approveQrLogin(code, scan, authHeader);
      setView({ step: 'done', label: scan.requester.label });
    } catch (failure) {
      const kind = classifyPasskeyError(failure);
      // Cancelled the prompt or a passkey that did not match: the code still waits, so stay and let them try again
      if (kind === 'cancelled' || kind === 'failed') setView({ step: 'ready', scan, busy: false, error: PASSKEY_MESSAGES[kind] });
      else setView({ step: 'problem', problem: qrProblem(failure) });
    }
  }

  async function refuse() {
    if (authHeader) await denyQrLogin(code, authHeader).catch(() => undefined);
    toast('Inloggen geweigerd');
    onClose();
  }

  async function handleAddPasskey() {
    if (!authHeader) return;
    try {
      await updateUserState(await addPasskey(authHeader));
      toast.success('Passkey toegevoegd', { description: 'Scan de code op het andere apparaat opnieuw.' });
      onClose();
    } catch (failure) {
      toast.error(PASSKEY_MESSAGES[classifyPasskeyError(failure)]);
    }
  }

  return (
    <ResponsiveDialog open onClose={onClose} title="Inloggen op een ander apparaat?" description="Bevestig met je passkey." hideHeader compact className="sm:max-w-md">
      <div className="flex flex-col gap-4 pb-2">
        {view.step === 'loading' && (
          <>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </>
        )}

        {view.step === 'ready' && (
          <>
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
            {view.error && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {view.error}
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Button size="lg" className="w-full" onClick={() => confirm(view.scan)} disabled={view.busy}>
                {view.busy ? <Loader2Icon className="animate-spin" /> : <KeyRoundIcon />}
                Bevestigen met passkey
              </Button>
              <Button size="lg" variant="outline" className="w-full" onClick={refuse} disabled={view.busy}>
                Nee, dat ben ik niet
              </Button>
            </div>
          </>
        )}

        {view.step === 'done' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CookieBadge tone="ok" size={72} />
            <h2 className="text-lg font-bold">Ingelogd</h2>
            <p className="text-sm text-muted-foreground">{view.label} is nu ingelogd als {user?.name}.</p>
            <Button className="w-full" onClick={onClose}>
              Naar de kaart
            </Button>
          </div>
        )}

        {view.step === 'problem' && (
          <div className="flex flex-col gap-4">
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
            <Button variant="outline" className="w-full" onClick={onClose}>
              Sluiten
            </Button>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  );
}
