import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate, useParams } from 'react-router';
import { KeyRoundIcon, Link2OffIcon, Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AuthScreen from '@/components/auth/AuthScreen';
import AuthSwap from '@/components/auth/AuthSwap';
import WelcomeCard from '@/components/auth/WelcomeCard';
import Reveal from '@/components/motion/Reveal';
import { fetchRecovery, passkeysSupported, recoverWithoutPasskey, recoverWithPasskey } from '@/lib/auth-api';
import { classifyPasskeyError, isLinkGone, PASSKEY_MESSAGES, SESSION_NOT_STORED } from '@/lib/passkey';
import { SWAP } from '@/lib/motion';
import UnreachableCard from '@/components/auth/UnreachableCard';
import { useStartSession } from '@/hooks/start-session.hook';
import InlineError from '@/components/InlineError';
import { AUTH_CARD } from '@/components/auth/auth-card';
import { cn } from '@/lib/utils';

export default function Herstel() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const startSession = useStartSession();
  const [state, setState] = useState<{ valid: boolean; name?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; withPasskey: boolean } | null>(null);
  const supported = passkeysSupported();

  /** The link couldn't be checked (no answer, server error): retry, it isn't "expired" */
  const [unreachable, setUnreachable] = useState(false);
  /** Recovered, but the browser didn't keep the session: the button goes to login */
  const [recovered, setRecovered] = useState(false);

  const load = useCallback(
    () =>
      fetchRecovery(token).then(
        (result) => {
          setState(result);
          setUnreachable(false);
        },
        (failure) => {
          if (isLinkGone(failure)) setState({ valid: false });
          else setUnreachable(true);
        },
      ),
    [token],
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      const result = supported ? await recoverWithPasskey(token) : await recoverWithoutPasskey(token);
      // The link is used up now; a browser that won't keep the session gets told what to do instead of a welcome
      if (!startSession(result)) {
        setError(supported ? SESSION_NOT_STORED.withPasskey : SESSION_NOT_STORED.withoutPasskey);
        setRecovered(true);
        return;
      }
      setDone({ name: result.user.name, withPasskey: supported });
    } catch (failure) {
      const kind = classifyPasskeyError(failure);
      if (kind === 'link-gone') setState({ valid: false });
      else setError(PASSKEY_MESSAGES[kind]);
    } finally {
      setBusy(false);
    }
  }

  let scene: string;
  let content: ReactNode;
  if (done) [scene, content] = ['done', <WelcomeCard name={done.name} withPasskey={done.withPasskey} />];
  else if (unreachable && !state) [scene, content] = ['unreachable', <UnreachableCard onRetry={load} />];
  else if (!state) [scene, content] = ['loading', <Skeleton className="h-60 w-full max-w-sm rounded-[28px]" />];
  else if (!state.valid) [scene, content] = ['invalid', renderInvalid()];
  else [scene, content] = ['form', renderForm(state.name)];

  return (
    <AuthScreen>
      <AuthSwap scene={scene}>{content}</AuthSwap>
    </AuthScreen>
  );

  function renderInvalid() {
    return (
      <div className={cn(AUTH_CARD, 'flex w-full max-w-sm flex-col items-center gap-3 p-7 text-center')}>
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
          <Link2OffIcon className="size-5 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-bold tracking-tight">Deze herstel-link werkt niet meer</h2>
        <p className="text-sm/relaxed text-muted-foreground">De link is verlopen of al gebruikt. Vraag de organisatie om een nieuwe.</p>
        <Button variant="outline" className="mt-1 w-full" onClick={() => navigate('/login')}>
          Naar inloggen
        </Button>
      </div>
    );
  }

  function renderForm(name: string | undefined) {
    return (
      <div className={cn(AUTH_CARD, 'flex w-full max-w-sm flex-col gap-4 p-6 md:p-8')}>
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="" className="size-10" />
          <div>
            <h1 className="text-xl font-bold leading-tight">Hoi {name}!</h1>
            <p className="text-sm text-muted-foreground">{supported ? 'Maak een nieuwe passkey' : 'Log in op dit apparaat'}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {supported ? 'Je apparaat vraagt om je vingerafdruk, gezicht of schermvergrendeling. Daarna ben je ingelogd.' : 'Deze browser ondersteunt geen passkeys. Je wordt ingelogd zonder passkey.'}
        </p>
        <Button size="lg" className="w-full" onClick={recovered ? () => navigate('/login') : handleClick} disabled={busy}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={recovered ? 'login' : 'recover'} className="inline-flex items-center gap-2" {...SWAP}>
              {recovered ? (
                'Naar inloggen'
              ) : (
                <>
                  {busy ? <Loader2Icon className="animate-spin" /> : supported && <KeyRoundIcon />}
                  {supported ? 'Passkey maken' : 'Inloggen'}
                </>
              )}
            </motion.span>
          </AnimatePresence>
        </Button>
        <Reveal gap={16}>
          {error && (
            <InlineError role="alert">
              {error}
            </InlineError>
          )}
        </Reveal>
      </div>
    );
  }
}
