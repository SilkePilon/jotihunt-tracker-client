import { useState } from 'react';
import { useNavigate } from 'react-router';
import { KeyRoundIcon, Loader2Icon } from 'lucide-react';
import usePWA from 'react-pwa-install-prompt';
import { isMobile } from 'react-device-detect';
import { Button } from '@/components/ui/button';
import AuthScreen from '@/components/auth/AuthScreen';
import { passkeyLogin, passkeysSupported } from '@/lib/auth-api';
import { classifyPasskeyError, PASSKEY_MESSAGES } from '@/lib/passkey';
import { useStartSession } from '@/hooks/start-session.hook';

export default function Login() {
  const navigate = useNavigate();
  const startSession = useStartSession();
  const { isStandalone, isInstallPromptSupported, promptInstall } = usePWA();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(passkeysSupported() ? null : PASSKEY_MESSAGES.unsupported);

  async function handleLogin() {
    setBusy(true);
    setError(null);
    try {
      if (!startSession(await passkeyLogin())) throw new Error('Sign-in failed');
      navigate('/');
      if (isInstallPromptSupported && !isStandalone && isMobile) promptInstall();
    } catch (failure) {
      setError(PASSKEY_MESSAGES[classifyPasskeyError(failure)]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScreen>
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-card-foreground shadow-lg md:p-8">
        <div className="flex flex-col gap-5">
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
          {error && (
            <p role="alert" className="text-xs font-medium text-destructive">
              {error}
            </p>
          )}
          <p className="text-xs text-muted-foreground">Geen account? Vraag de organisatie om een invite-link.</p>
        </div>
      </div>
    </AuthScreen>
  );
}
