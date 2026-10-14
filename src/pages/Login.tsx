import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import { KeyRoundIcon, Loader2Icon } from 'lucide-react';
import usePWA from 'react-pwa-install-prompt';
import { isMobile as isMobileDevice } from 'react-device-detect';
import { Button } from '@/components/ui/button';
import AuthScreen from '@/components/auth/AuthScreen';
import QrLoginPanel from '@/components/auth/QrLoginPanel';
import Reveal from '@/components/motion/Reveal';
import { passkeyLogin, passkeysSupported, type SessionResult } from '@/lib/auth-api';
import { classifyPasskeyError, PASSKEY_MESSAGES } from '@/lib/passkey';
import { CARD_ENTER, EASE_OUT } from '@/lib/motion';
import { nextAfterLogin } from '@/lib/qr-login';
import { useStartSession } from '@/hooks/start-session.hook';
import { useIsMobile } from '@/hooks/media.hook';

const APPROVED_SHOW_MS = 1200;
const LEAVE_MS = 200;

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startSession = useStartSession();
  const isMobile = useIsMobile();
  const { isStandalone, isInstallPromptSupported, promptInstall } = usePWA();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(passkeysSupported() ? null : PASSKEY_MESSAGES.unsupported);
  const next = nextAfterLogin(searchParams.get('next'));
  /** Fading the card out after a QR approval, right before the map takes over */
  const [leaving, setLeaving] = useState(false);
  const approvedTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => approvedTimers.current.forEach(clearTimeout), []);

  function enter(result: SessionResult) {
    if (!startSession(result)) throw new Error('Sign-in failed');
    navigate(next, { replace: true });
  }

  async function handleLogin() {
    setBusy(true);
    setError(null);
    try {
      enter(await passkeyLogin());
      if (isInstallPromptSupported && !isStandalone && isMobileDevice) promptInstall();
    } catch (failure) {
      setError(PASSKEY_MESSAGES[classifyPasskeyError(failure)]);
    } finally {
      setBusy(false);
    }
  }

  function handleQrApproved(result: SessionResult) {
    // Let the check and "Ingelogd" play out, then fade the card before the map takes over
    approvedTimers.current.push(
      setTimeout(() => setLeaving(true), APPROVED_SHOW_MS - LEAVE_MS),
      setTimeout(() => {
        try {
          enter(result);
        } catch (failure) {
          setLeaving(false);
          setError(PASSKEY_MESSAGES[classifyPasskeyError(failure)]);
        }
      }, APPROVED_SHOW_MS),
    );
  }

  return (
    <AuthScreen>
      <motion.div
        className="w-full max-w-sm rounded-xl border bg-card text-card-foreground shadow-lg md:grid md:max-w-3xl md:grid-cols-[1fr_auto_auto]"
        initial={CARD_ENTER.initial}
        animate={leaving ? { opacity: 0, y: 0, scale: 0.98 } : { ...CARD_ENTER.animate, scale: 1 }}
        transition={leaving ? { duration: LEAVE_MS / 1000, ease: EASE_OUT } : CARD_ENTER.transition}
      >
        <div className="flex flex-col justify-center gap-5 p-6 md:p-8">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="" className="size-10" />
            <div>
              <h1 className="text-xl font-bold leading-tight">Welkom terug!</h1>
              <p className="text-sm text-muted-foreground">Jotihunt Tracker</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Gebruik de vingerafdruk, het gezicht of de schermvergrendeling van dit apparaat.</p>
          <Button size="lg" className="w-full" onClick={handleLogin} disabled={busy || !passkeysSupported()}>
            {busy ? <Loader2Icon className="animate-spin" /> : <KeyRoundIcon />}
            Inloggen met passkey
          </Button>
          <Reveal gap={20}>
            {error && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {error}
              </p>
            )}
          </Reveal>
          <p className="text-xs text-muted-foreground">Geen account? Vraag de organisatie om een invite-link.</p>
        </div>
        {/* Phones log in with their own passkey; only laptops and the beamer need the code */}
        {!isMobile && (
          <>
            <div className="my-8 w-px bg-border" />
            <QrLoginPanel onApproved={handleQrApproved} />
          </>
        )}
      </motion.div>
    </AuthScreen>
  );
}
