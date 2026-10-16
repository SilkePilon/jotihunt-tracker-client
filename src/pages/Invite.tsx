import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
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
import { classifyPasskeyError, INVITE_REASON_TEXT, inviteGoneReason, PASSKEY_MESSAGES, type InviteReason } from '@/lib/passkey';
import { useStartSession } from '@/hooks/start-session.hook';
import InlineError from '@/components/InlineError';

const FALLBACK_LOGO = import.meta.env.LOGO_URL || '/logo.svg';

function GroupLogo({ url, className }: { url: string | null; className: string }) {
  return <img src={url ?? FALLBACK_LOGO} alt="" className={`${className} rounded-2xl object-cover ring-1 ring-border`} onError={(event) => (event.currentTarget.src = FALLBACK_LOGO)} />;
}

function InvalidCard({ text }: { text: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border bg-card p-7 text-center shadow-lg">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
        <Link2OffIcon className="size-5 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-medium tracking-tight">Deze uitnodiging werkt niet meer</h2>
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Why the server refused the signup (410); the invite info loaded earlier is stale then */
  const [goneReason, setGoneReason] = useState<InviteReason | null>(null);
  const [done, setDone] = useState<{ name: string; withPasskey: boolean } | null>(null);
  const supported = passkeysSupported();

  useEffect(() => {
    fetchInvite(code)
      .then(setInvite)
      .catch((failure) => setLoadError(PASSKEY_MESSAGES[classifyPasskeyError(failure)]));
  }, [code]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Vul je naam in.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = supported ? await registerWithInvite(code, trimmed) : await registerWithInviteWithoutPasskey(code, trimmed);
      startSession(result);
      setDone({ name: result.user.name, withPasskey: (result.user.passkeyCount ?? 0) > 0 });
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
  else if (loadError) [scene, content] = ['invalid', <InvalidCard text={loadError} />];
  else if (!invite) [scene, content] = ['loading', <Skeleton className="h-72 w-full max-w-[760px] rounded-xl" />];
  else if (goneReason) [scene, content] = ['invalid', <InvalidCard text={INVITE_REASON_TEXT[goneReason]} />];
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
      <div className="w-full max-w-[760px] overflow-hidden rounded-xl border bg-card text-card-foreground shadow-lg md:grid md:grid-cols-[1fr_auto_1fr]">
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
            <h2 className="text-lg font-semibold">Maak je account</h2>
            <p className="text-sm text-muted-foreground">Kost 10 seconden.</p>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="invite-name" className="text-sm font-medium">
              Hoe heet je?
            </label>
            <Input id="invite-name" value={name} maxLength={40} autoComplete="nickname" placeholder="Je naam" onChange={(event) => setName(event.target.value)} />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? <Loader2Icon className="animate-spin" /> : supported && <KeyRoundIcon />}
            {supported ? 'Account maken met passkey' : 'Account maken'}
          </Button>
          <Reveal gap={16}>
            {error && (
              <InlineError role="alert">
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
