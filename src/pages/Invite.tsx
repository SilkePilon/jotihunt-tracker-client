import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { KeyRoundIcon, Link2OffIcon, Loader2Icon, UsersIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import AuthScreen from '@/components/auth/AuthScreen';
import AuthSwap from '@/components/auth/AuthSwap';
import WelcomeCard from '@/components/auth/WelcomeCard';
import Reveal from '@/components/motion/Reveal';
import { fetchInvite, passkeysSupported, registerWithInvite, registerWithInviteWithoutPasskey, type InviteInfo } from '@/lib/auth-api';
import { classifyPasskeyError, INVITE_REASON_TEXT, inviteGoneReason, isLinkGone, PASSKEY_MESSAGES, SESSION_NOT_STORED, type InviteReason } from '@/lib/passkey';
import UnreachableCard from '@/components/auth/UnreachableCard';
import { AnimatePresence, motion } from 'motion/react';
import { SWAP } from '@/lib/motion';
import { useStartSession } from '@/hooks/start-session.hook';
import InlineError from '@/components/InlineError';
import { useAppConfig } from '@/hooks/app-config.hook';
import { apiAssetUrl } from '@/lib/app-config';
import { AUTH_CARD } from '@/components/auth/auth-card';
import { cn } from '@/lib/utils';

function GroupLogo({ url, className }: { url: string | null; className: string }) {
  const fallback = apiAssetUrl(useAppConfig().logoUrl);
  return <img src={url ? apiAssetUrl(url) : fallback} alt="" className={`${className} rounded-2xl object-cover ring-1 ring-border`} onError={(event) => (event.currentTarget.src = fallback)} />;
}

function InvalidCard({ text }: { text: string }) {
  const navigate = useNavigate();
  return (
    <div className={cn(AUTH_CARD, 'flex w-full max-w-sm flex-col items-center gap-3 p-7 text-center')}>
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
        <Link2OffIcon className="size-5 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-bold tracking-tight">Deze uitnodiging werkt niet meer</h2>
      <p className="text-sm/relaxed text-muted-foreground">{text}</p>
      <Button variant="outline" className="mt-1 w-full" onClick={() => navigate('/login')}>
        Naar inloggen
      </Button>
    </div>
  );
}

export default function Invite() {
  const { code = '' } = useParams();
  const startSession = useStartSession();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  /** The invite couldn't be checked (no answer, server error): retry, it isn't "gone" */
  const [unreachable, setUnreachable] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The error is about the name field (empty): it is marked invalid and describes itself with the error line */
  const [nameInvalid, setNameInvalid] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  /** Why the server refused the signup (410); the invite info loaded earlier is stale then */
  const [goneReason, setGoneReason] = useState<InviteReason | null>(null);
  const [done, setDone] = useState<{ name: string; withPasskey: boolean } | null>(null);
  /** The account was made but the session wasn't stored: the form stays with the error, the button goes to login */
  const [signupDone, setSignupDone] = useState(false);
  const navigate = useNavigate();
  const supported = passkeysSupported();

  const load = useCallback(
    () =>
      fetchInvite(code).then(
        (info) => {
          setInvite(info);
          setUnreachable(false);
        },
        (failure) => {
          // A 410 here still names why; 404 is already an invalid invite. Anything else: not reachable, not expired.
          const reason = isLinkGone(failure) ? (inviteGoneReason(failure) ?? 'unknown') : null;
          if (reason) setGoneReason(reason);
          else setUnreachable(true);
        },
      ),
    [code],
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Vul je naam in.');
      setNameInvalid(true);
      nameInput.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    setNameInvalid(false);
    try {
      const result = supported ? await registerWithInvite(code, trimmed) : await registerWithInviteWithoutPasskey(code, trimmed);
      const withPasskey = (result.user.passkeyCount ?? 0) > 0;
      // The account exists now; a browser that won't keep the session must not show the welcome (or a retry that makes a second account)
      if (!startSession(result)) {
        setError(withPasskey ? SESSION_NOT_STORED.withPasskey : SESSION_NOT_STORED.withoutPasskey);
        setSignupDone(true);
        return;
      }
      setDone({ name: result.user.name, withPasskey });
    } catch (failure) {
      const reason = inviteGoneReason(failure);
      if (reason) setGoneReason(reason);
      else setError(PASSKEY_MESSAGES[classifyPasskeyError(failure)]);
    } finally {
      setBusy(false);
    }
  }

  let scene: string;
  let content: ReactNode;
  if (done) [scene, content] = ['done', <WelcomeCard name={done.name} withPasskey={done.withPasskey} />];
  else if (goneReason) [scene, content] = ['invalid', <InvalidCard text={INVITE_REASON_TEXT[goneReason]} />];
  else if (unreachable) [scene, content] = ['unreachable', <UnreachableCard onRetry={load} />];
  else if (!invite) [scene, content] = ['loading', <Skeleton className="h-72 w-full max-w-[760px] rounded-[28px]" />];
  else if (!invite.valid) [scene, content] = ['invalid', <InvalidCard text={INVITE_REASON_TEXT[invite.reason ?? 'unknown']} />];
  else [scene, content] = ['form', renderForm(invite)];

  return (
    <AuthScreen>
      <AuthSwap scene={scene}>{content}</AuthSwap>
    </AuthScreen>
  );

  function renderForm(invite: InviteInfo) {
    const counts = `${invite.memberCount} ${invite.memberCount === 1 ? 'lid' : 'leden'}`;
    return (
      <div className={cn(AUTH_CARD, 'w-full max-w-[760px] overflow-hidden md:grid md:grid-cols-[1fr_auto_1fr]')}>
        {/* Phone: compact header row; desktop: big left half */}
        <div className="flex items-center gap-3 border-b p-5 md:flex-col md:justify-center md:gap-4 md:border-b-0 md:p-8 md:text-center">
          <GroupLogo url={invite.group.logoUrl} className="size-11 md:size-20" />
          <div>
            <p className="text-xs text-muted-foreground md:text-sm">{invite.invitedBy ? `${invite.invitedBy} nodigt je uit voor` : 'Je bent uitgenodigd voor'}</p>
            <h1 className="text-lg font-bold leading-tight md:text-2xl">{invite.group.name}</h1>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground md:mt-1 md:justify-center">
              <UsersIcon className="hidden size-3.5 md:block" />
              {counts}
            </p>
          </div>
        </div>
        <div className="my-8 hidden w-px bg-border md:block" />
        <form className="flex flex-col justify-center gap-4 p-5 md:p-8" onSubmit={handleSubmit}>
          <div className="hidden md:block">
            <h2 className="text-lg font-bold">Maak je account</h2>
            <p className="text-sm text-muted-foreground">Kost 10 seconden.</p>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="invite-name" className="text-sm font-medium">
              Hoe heet je?
            </label>
            <Input
              ref={nameInput}
              id="invite-name"
              value={name}
              maxLength={40}
              autoComplete="nickname"
              placeholder="Je naam"
              aria-invalid={nameInvalid || undefined}
              aria-describedby={nameInvalid && error ? 'invite-error' : undefined}
              onChange={(event) => {
                setName(event.target.value);
                // Typing a name fixes it: the field is no longer invalid and the "Vul je naam in." line folds away
                if (nameInvalid && event.target.value.trim()) {
                  setNameInvalid(false);
                  setError(null);
                }
              }}
            />
          </div>
          <Button type={signupDone ? 'button' : 'submit'} size="lg" className="w-full" disabled={busy} onClick={signupDone ? () => navigate('/login') : undefined}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={signupDone ? 'login' : 'signup'} className="inline-flex items-center gap-2" {...SWAP}>
                {signupDone ? (
                  'Naar inloggen'
                ) : (
                  <>
                    {busy ? <Loader2Icon className="animate-spin" /> : supported && <KeyRoundIcon />}
                    {supported ? 'Account maken met passkey' : 'Account maken'}
                  </>
                )}
              </motion.span>
            </AnimatePresence>
          </Button>
          <Reveal gap={16}>
            {error && (
              <InlineError id="invite-error" role="alert">
                {error}
              </InlineError>
            )}
          </Reveal>
          <p className="text-xs text-muted-foreground">
            {supported ? 'Je apparaat vraagt om je vingerafdruk, gezicht of schermvergrendeling.' : 'Deze browser ondersteunt geen passkeys; je kunt er later een toevoegen.'}
          </p>
        </form>
      </div>
    );
  }
}
