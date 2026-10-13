import { FormEvent, ReactNode, useId, useState } from 'react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { Loader2Icon, XIcon } from 'lucide-react';
import { inlineLinkClass } from '@/components/tracker/styles';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useNow } from '@/hooks/now.hook';
import { isSixDigits, resendCountdown } from '@/lib/life360';
import { cn } from '@/lib/utils';
import type { Life360AdminStatus, Life360Circle } from '@/types/Life360';
import Life360Logo from './Life360Logo';
import { LIFE360_BUTTON } from './styles';

/** The step actions resolve to an error text to show, or null when the server accepted. */
export interface Life360LinkActions {
  /** Ask Life360 to e-mail a login code (also "Stuur nieuwe code") */
  onSendCode: (email: string) => Promise<string | null>;
  /** The 6 digits from the e-mail */
  onVerifyCode: (code: string) => Promise<string | null>;
  /** The team circle, when the account has more than one */
  onChooseCircle: (circleId: string) => Promise<string | null>;
  /** Fallback: a LIFE360_AUTH_TOKEN pasted by hand */
  onSubmitToken: (token: string) => Promise<string | null>;
  /** Cancel a pending login (code or circle step); resolves to true once cancelled */
  onCancel: () => Promise<boolean>;
}

export type Life360LinkView = 'unavailable' | 'unlinked' | 'email' | 'code' | 'circle';

/** One joined 42px bar split by hairlines; purple inset focus ring, red when the code was wrong. */
const OTP_SLOT =
  'h-[42px] flex-1 font-mono text-lg font-bold first:rounded-l-lg last:rounded-r-lg data-[active=true]:border-[#7875ea] data-[active=true]:ring-2 data-[active=true]:ring-inset data-[active=true]:ring-[#7875ea]/40';

function Header({ title, onCancel }: { title: string; onCancel: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold">{title}</span>
      <Button type="button" variant="ghost" size="icon" className="size-6 text-muted-foreground" aria-label="Koppelen annuleren" onClick={onCancel}>
        <XIcon />
      </Button>
    </div>
  );
}

function ErrorText({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="text-xs font-medium text-destructive">
      {children}
    </p>
  );
}

/** "Lukt het niet? Plak token": hidden until clicked; for when the code never arrives. */
function TokenFallback({ onSubmitToken }: { onSubmitToken: Life360LinkActions['onSubmitToken'] }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errorId = useId();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = token.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(await onSubmitToken(value));
    setBusy(false);
  }

  return (
    <Collapsible className="flex flex-col">
      <CollapsibleTrigger className={cn(inlineLinkClass, 'self-start text-[11px] font-normal text-muted-foreground')}>Lukt het niet? Plak token</CollapsibleTrigger>
      <CollapsibleContent>
        <form className="flex flex-col gap-2 pt-2" onSubmit={submit}>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Log in op life360.com en kopieer de cookie <b className="font-semibold text-foreground">LIFE360_AUTH_TOKEN</b>.
          </p>
          <Input
            aria-label="Life360-token"
            autoComplete="off"
            spellCheck={false}
            value={token}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setToken(event.target.value);
              setError(null);
            }}
          />
          {error && <ErrorText id={errorId}>{error}</ErrorText>}
          <Button type="submit" variant="outline" size="sm" disabled={!token.trim() || busy}>
            {busy && <Loader2Icon className="animate-spin" />}
            Koppel met token
          </Button>
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}

function EmailStep({
  initialEmail,
  onSendCode,
  onSubmitToken,
  onClose,
}: {
  initialEmail: string;
  onSendCode: Life360LinkActions['onSendCode'];
  onSubmitToken: Life360LinkActions['onSubmitToken'];
  onClose: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errorId = useId();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = email.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(await onSendCode(value));
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-2" data-life360-state="email">
      <form className="flex flex-col gap-2" onSubmit={submit}>
        <Header title="Inloggen bij Life360" onCancel={onClose} />
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          aria-label="E-mailadres van het Life360-account"
          placeholder="naam@voorbeeld.nl"
          value={email}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(null);
          }}
        />
        {error && <ErrorText id={errorId}>{error}</ErrorText>}
        <Button type="submit" className={LIFE360_BUTTON} disabled={!email.trim() || busy}>
          {busy && <Loader2Icon className="animate-spin" />}
          Stuur code
        </Button>
        <p className="text-[11px] leading-snug text-muted-foreground">Life360 mailt een code van 6 cijfers. Gebruik een apart account, niet je eigen.</p>
      </form>
      <TokenFallback onSubmitToken={onSubmitToken} />
    </div>
  );
}

function CodeStep({
  email,
  resendAt,
  onVerifyCode,
  onSendCode,
  onCancel,
  onOtherAddress,
}: {
  email: string;
  resendAt: string;
  onVerifyCode: Life360LinkActions['onVerifyCode'];
  onSendCode: Life360LinkActions['onSendCode'];
  onCancel: () => void;
  onOtherAddress: () => void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const errorId = useId();
  const now = useNow(true);
  const countdown = resendCountdown(resendAt, now);

  async function verify(value: string) {
    if (!isSixDigits(value) || busy) return;
    setBusy(true);
    setError(await onVerifyCode(value));
    setBusy(false);
  }

  async function resend() {
    if (resending) return;
    setResending(true);
    const message = await onSendCode(email);
    setResending(false);
    setResendError(message);
    if (!message) {
      setCode('');
      setError(null);
    }
  }

  return (
    <form
      className="flex flex-col gap-2"
      data-life360-state="code"
      onSubmit={(event) => {
        event.preventDefault();
        void verify(code);
      }}
    >
      <Header title="Code uit je mail" onCancel={onCancel} />
      <p className="text-xs text-muted-foreground">
        Gestuurd naar <b className="font-semibold break-all text-foreground">{email}</b>
      </p>
      <InputOTP
        maxLength={6}
        pattern={REGEXP_ONLY_DIGITS}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        aria-label="Code van 6 cijfers"
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        disabled={busy}
        value={code}
        onChange={(value: string) => {
          setCode(value);
          setError(null);
        }}
        // Pasting or typing the 6th digit submits right away
        onComplete={(value: string) => void verify(value)}
        containerClassName="w-full"
      >
        <InputOTPGroup className="w-full">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <InputOTPSlot key={index} index={index} aria-invalid={!!error} className={OTP_SLOT} />
          ))}
        </InputOTPGroup>
      </InputOTP>
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
      {error ? (
        <Button type="button" variant="outline" disabled={!!countdown || resending} onClick={() => void resend()}>
          {resending && <Loader2Icon className="animate-spin" />}
          {countdown ? `Stuur nieuwe code (${countdown})` : 'Stuur nieuwe code'}
        </Button>
      ) : (
        <Button type="submit" className={LIFE360_BUTTON} disabled={!isSixDigits(code) || busy}>
          {busy && <Loader2Icon className="animate-spin" />}
          Koppelen
        </Button>
      )}
      {resendError && <ErrorText>{resendError}</ErrorText>}
      <p className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        {/* After a wrong code the "Stuur nieuwe code" button already carries the countdown */}
        {error ? (
          <span />
        ) : countdown ? (
          <span className="tabular-nums">Opnieuw sturen over {countdown}</span>
        ) : (
          <button type="button" className={inlineLinkClass} disabled={resending} onClick={() => void resend()}>
            Opnieuw sturen
          </button>
        )}
        <button type="button" className={inlineLinkClass} onClick={onOtherAddress}>
          ander adres
        </button>
      </p>
    </form>
  );
}

function CircleStep({ circles, onChooseCircle, onCancel }: { circles: Life360Circle[]; onChooseCircle: Life360LinkActions['onChooseCircle']; onCancel: () => void }) {
  const [selected, setSelected] = useState(circles[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected || busy) return;
    setBusy(true);
    setError(await onChooseCircle(selected));
    setBusy(false);
  }

  return (
    <form className="flex flex-col gap-2" data-life360-state="circle" onSubmit={submit}>
      <Header title="Welke cirkel?" onCancel={onCancel} />
      <div role="radiogroup" aria-label="Life360-cirkel" className="flex flex-col gap-1.5">
        {circles.map((circle) => {
          const checked = circle.id === selected;
          return (
            <button
              key={circle.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => setSelected(circle.id)}
              className={cn('flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-[13px] transition-colors', checked && 'border-[#7875ea]')}
            >
              <span aria-hidden className={cn('size-4 shrink-0 rounded-full border-[1.5px] border-zinc-400', checked && 'border-[5px] border-[#7875ea]')} />
              <span className="min-w-0 flex-1 truncate">{circle.name}</span>
            </button>
          );
        })}
      </div>
      {error && <ErrorText>{error}</ErrorText>}
      <Button type="submit" className={LIFE360_BUTTON} disabled={!selected || busy}>
        {busy && <Loader2Icon className="animate-spin" />}
        Gebruik deze cirkel
      </Button>
    </form>
  );
}

export interface Life360LinkPanelProps extends Life360LinkActions {
  view: Life360LinkView;
  /** The server status; its email / resendAt / circles feed the code and circle steps */
  status: Life360AdminStatus;
  /** Address the e-mail step starts with ("ander adres" keeps the previous one) */
  emailPrefill: string;
  /** "Koppel Life360": open the e-mail step (local only, the server stays unlinked) */
  onOpenEmail: () => void;
  /** ✕ on the e-mail step */
  onCloseEmail: () => void;
  /** "ander adres" on the code step: cancel the login and go back to the e-mail step */
  onOtherAddress: () => void;
}

/** Admins: link the team's Life360 account (inside the Life360 card) — every step before "linked". */
export default function Life360LinkPanel({ view, status, emailPrefill, onOpenEmail, onCloseEmail, onOtherAddress, ...actions }: Life360LinkPanelProps) {
  const cancel = () => void actions.onCancel();

  switch (view) {
    case 'unavailable':
      return <p className="text-xs text-muted-foreground">Life360 is niet ingesteld op de server (LIFE360_SESSION_KEY).</p>;
    case 'unlinked':
      return (
        <div className="flex flex-col gap-2.5" data-life360-state="unlinked">
          <p className="text-xs text-muted-foreground">Koppel het Life360-account dat in de team-cirkel zit. Iedereen in die cirkel verschijnt dan als eigen laag op de kaart.</p>
          <Button size="lg" className={cn('h-11 w-full rounded-lg text-sm font-semibold', LIFE360_BUTTON)} onClick={onOpenEmail}>
            <Life360Logo className="size-5" />
            Koppel Life360
          </Button>
        </div>
      );
    case 'email':
      return <EmailStep initialEmail={emailPrefill} onSendCode={actions.onSendCode} onSubmitToken={actions.onSubmitToken} onClose={onCloseEmail} />;
    case 'code':
      return status.state === 'code' ? (
        <CodeStep email={status.email} resendAt={status.resendAt} onVerifyCode={actions.onVerifyCode} onSendCode={actions.onSendCode} onCancel={cancel} onOtherAddress={onOtherAddress} />
      ) : null;
    case 'circle':
      return status.state === 'circle' ? <CircleStep circles={status.circles} onChooseCircle={actions.onChooseCircle} onCancel={cancel} /> : null;
  }
}
