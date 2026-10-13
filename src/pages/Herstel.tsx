import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { KeyRoundIcon, Link2OffIcon, Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AuthScreen from '@/components/auth/AuthScreen';
import WelcomeCard from '@/components/auth/WelcomeCard';
import { fetchRecovery, passkeysSupported, recoverWithoutPasskey, recoverWithPasskey } from '@/lib/auth-api';
import { classifyPasskeyError, PASSKEY_MESSAGES } from '@/lib/passkey';
import { useStartSession } from '@/hooks/start-session.hook';

export default function Herstel() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const startSession = useStartSession();
  const [state, setState] = useState<{ valid: boolean; name?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; withPasskey: boolean } | null>(null);
  const supported = passkeysSupported();

  useEffect(() => {
    fetchRecovery(token)
      .then(setState)
      .catch(() => setState({ valid: false }));
  }, [token]);

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      const result = supported ? await recoverWithPasskey(token) : await recoverWithoutPasskey(token);
      startSession(result);
      setDone({ name: result.user.name, withPasskey: supported });
    } catch (failure) {
      const kind = classifyPasskeyError(failure);
      if (kind === 'link-gone') setState({ valid: false });
      else setError(PASSKEY_MESSAGES[kind]);
    } finally {
      setBusy(false);
    }
  }

  if (done) return <AuthScreen><WelcomeCard name={done.name} withPasskey={done.withPasskey} /></AuthScreen>;
  if (!state) return <AuthScreen><Skeleton className="h-60 w-full max-w-sm rounded-xl" /></AuthScreen>;

  if (!state.valid) {
    return (
      <AuthScreen>
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border bg-card p-7 text-center shadow-lg">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <Link2OffIcon className="size-5 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium tracking-tight">Deze herstel-link werkt niet meer</h2>
          <p className="text-sm/relaxed text-muted-foreground">De link is verlopen of al gebruikt. Vraag de organisatie om een nieuwe.</p>
          <Button variant="outline" className="mt-1 w-full" onClick={() => navigate('/login')}>
            Naar inloggen
          </Button>
        </div>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border bg-card p-6 text-card-foreground shadow-lg md:p-8">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="" className="size-10" />
          <div>
            <h1 className="text-xl font-bold leading-tight">Hoi {state.name}!</h1>
            <p className="text-sm text-muted-foreground">{supported ? 'Maak een nieuwe passkey' : 'Log in op dit apparaat'}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {supported ? 'Je apparaat vraagt om je vingerafdruk, gezicht of schermvergrendeling. Daarna ben je ingelogd.' : 'Deze browser ondersteunt geen passkeys. Je wordt ingelogd zonder passkey.'}
        </p>
        <Button size="lg" className="w-full" onClick={handleClick} disabled={busy}>
          {busy ? <Loader2Icon className="animate-spin" /> : supported && <KeyRoundIcon />}
          {supported ? 'Passkey maken' : 'Inloggen'}
        </Button>
        {error && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
    </AuthScreen>
  );
}
