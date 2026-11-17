import { FormEvent, useId, useState } from 'react';
import InlineError from '@/components/InlineError';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { XIcon } from 'lucide-react';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import BusyIcon from '@/components/motion/BusyIcon';
import Reveal from '@/components/motion/Reveal';
import { inlineLinkClass } from '@/components/tracker/styles';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useEdition } from '@/hooks/edition.hook';
import { useNow } from '@/hooks/now.hook';
import { usePending } from '@/hooks/pending.hook';
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

/** Six 42px tonal boxes (ui/input-otp); purple inset ring on the box being typed in, red when the code was wrong. */
const OTP_SLOT =
  'h-[42px] flex-1 font-mono text-lg font-bold data-[active=true]:ring-[#7875ea]';

/** Inline links ("Opnieuw sturen", "ander adres") while another request runs */
const LINK_DISABLED = 'disabled:cursor-default disabled:text-muted-foreground disabled:no-underline disabled:opacity-60';

const SEND_ERROR = 'Er ging iets mis, probeer het opnieuw.';

/** Turns a throwing action into its error text, so a step never stays busy */
async function settle(action: () => Promise<string | null>): Promise<string | null> {
  try {
    return await action();
  } catch {
    return SEND_ERROR;
  }
}

function Header({ title, onCancel, disabled, cancelling }: { title: string; onCancel: () => void; disabled?: boolean; cancelling?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold">{title}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative size-6 text-muted-foreground after:absolute after:-inset-2.5"
        aria-label="Koppelen annuleren"
        // The running ✕ keeps the focus (aria-disabled); a second tap is refused by usePending
        aria-disabled={cancelling || undefined}
        aria-busy={cancelling || undefined}
        disabled={disabled && !cancelling}
        onClick={onCancel}
      >
        <BusyIcon busy={!!cancelling} icon={<XIcon />} />
      </Button>
    </div>
  );
}

/** "Lukt het niet? Plak token": hidden until clicked; for when the code never arrives. */
function TokenFallback({ busy, blocked, onSubmit }: { busy: boolean; blocked: boolean; onSubmit: (token: string) => Promise<string | null | undefined> }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = token.trim();
    if (!value) return;
    const message = await onSubmit(value);
    if (message !== undefined) setError(message);
  }

  return (
    <Collapsible className="flex flex-col">
      <CollapsibleTrigger className={cn(inlineLinkClass, 'self-start text-xs font-normal text-muted-foreground desk:text-label')}>Lukt het niet? Plak token</CollapsibleTrigger>
      <CollapsibleContent>
        <form className="flex flex-col gap-2 pt-2" onSubmit={submit}>
          <p className="text-xs leading-snug text-muted-foreground desk:text-label">
            Log in op life360.com en kopieer de cookie <b className="font-semibold text-foreground">LIFE360_AUTH_TOKEN</b>.
          </p>
          <Input
            aria-label="Life360-token"
            autoComplete="off"
            spellCheck={false}
            value={token}
            readOnly={busy}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setToken(event.target.value);
              setError(null);
            }}
          />
          <Reveal gap={8}>{error && <InlineError id={errorId}>{error}</InlineError>}</Reveal>
          <Button type="submit" variant="outline" size="sm" disabled={!token.trim() || (blocked && !busy)} aria-disabled={busy || undefined} aria-busy={busy || undefined}>
            <BusyIcon busy={busy} />
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
  // Sending a code and pasting a token both link: one at a time, and ✕ waits until it settled
  const { pending, run } = usePending<'code' | 'token'>();
  const errorId = useId();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = email.trim();
    if (!value) return;
    const message = await run('code', () => settle(() => onSendCode(value)));
    if (message !== undefined) setError(message);
  }

  return (
    <div className="flex flex-col gap-2" data-life360-state="email">
      <form className="flex flex-col gap-2" onSubmit={submit}>
        <Header title="Inloggen bij Life360" onCancel={onClose} disabled={!!pending} />
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          aria-label="E-mailadres van het Life360-account"
          placeholder="naam@voorbeeld.nl"
          value={email}
          readOnly={!!pending}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(null);
          }}
        />
        <Reveal gap={8}>{error && <InlineError id={errorId}>{error}</InlineError>}</Reveal>
        <Button
          type="submit"
          className={LIFE360_BUTTON}
          // The running button stays focusable (aria-disabled); usePending refuses a second submit
          disabled={!email.trim() || (!!pending && pending !== 'code')}
          aria-disabled={pending === 'code' || undefined}
          aria-busy={pending === 'code' || undefined}
        >
          <BusyIcon busy={pending === 'code'} />
          Stuur code
        </Button>
        <p className="text-xs leading-snug text-muted-foreground desk:text-label">Life360 mailt een code van 6 cijfers. Gebruik een apart account, niet je eigen.</p>
      </form>
      <TokenFallback busy={pending === 'token'} blocked={!!pending} onSubmit={(token) => run('token', () => settle(() => onSubmitToken(token)))} />
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
  onCancel: () => Promise<unknown>;
  onOtherAddress: () => Promise<unknown>;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  // Verify, resend, ✕ and "ander adres" all change the same login: one at a time
  const { pending, run } = usePending<'verify' | 'resend' | 'cancel'>();
  const errorId = useId();
  const now = useNow(true);
  const countdown = resendCountdown(resendAt, now);

  async function verify(value: string) {
    if (!isSixDigits(value)) return;
    const message = await run('verify', () => settle(() => onVerifyCode(value)));
    if (message !== undefined) setError(message);
  }

  async function resend() {
    const message = await run('resend', () => settle(() => onSendCode(email)));
    if (message === undefined) return;
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
      <Header title="Code uit je mail" onCancel={() => void run('cancel', onCancel)} disabled={!!pending} cancelling={pending === 'cancel'} />
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
        disabled={!!pending}
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
      <Reveal gap={8}>{error && <InlineError id={errorId}>{error}</InlineError>}</Reveal>
      {error ? (
        <Button
          type="button"
          variant="outline"
          disabled={!!countdown || (!!pending && pending !== 'resend')}
          aria-disabled={pending === 'resend' || undefined}
          aria-busy={pending === 'resend' || undefined}
          onClick={() => void resend()}
        >
          <BusyIcon busy={pending === 'resend'} />
          {countdown ? (
            <>
              Stuur nieuwe code (<span className="tabular-nums">{countdown}</span>)
            </>
          ) : (
            'Stuur nieuwe code'
          )}
        </Button>
      ) : (
        <Button
          type="submit"
          className={LIFE360_BUTTON}
          disabled={!isSixDigits(code) || (!!pending && pending !== 'verify')}
          aria-disabled={pending === 'verify' || undefined}
          aria-busy={pending === 'verify' || undefined}
        >
          <BusyIcon busy={pending === 'verify'} />
          Koppelen
        </Button>
      )}
      <Reveal gap={8}>{resendError && <InlineError>{resendError}</InlineError>}</Reveal>
      <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground desk:text-label">
        {/* After a wrong code the "Stuur nieuwe code" button already carries the countdown */}
        {error ? (
          <span />
        ) : countdown ? (
          <span className="tabular-nums">Opnieuw sturen over {countdown}</span>
        ) : (
          <button type="button" className={cn(inlineLinkClass, LINK_DISABLED)} disabled={!!pending} onClick={() => void resend()}>
            {pending === 'resend' ? 'Sturen…' : 'Opnieuw sturen'}
          </button>
        )}
        <button type="button" className={cn(inlineLinkClass, LINK_DISABLED)} disabled={!!pending} onClick={() => void run('cancel', onOtherAddress)}>
          ander adres
        </button>
      </p>
    </form>
  );
}

function CircleStep({ circles, onChooseCircle, onCancel }: { circles: Life360Circle[]; onChooseCircle: Life360LinkActions['onChooseCircle']; onCancel: () => Promise<unknown> }) {
  const [selected, setSelected] = useState(circles[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const { pending, run } = usePending<'choose' | 'cancel'>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const message = await run('choose', () => settle(() => onChooseCircle(selected)));
    if (message !== undefined) setError(message);
  }

  return (
    <form className="flex flex-col gap-2" data-life360-state="circle" onSubmit={submit}>
      <Header title="Welke cirkel?" onCancel={() => void run('cancel', onCancel)} disabled={!!pending} cancelling={pending === 'cancel'} />
      {/* One Tab stop, arrow keys choose (Radix radio group) */}
      <RadioGroupPrimitive.Root aria-label="Life360-cirkel" value={selected} onValueChange={setSelected} disabled={!!pending} className="flex flex-col gap-1.5">
        {circles.map((circle) => {
          const checked = circle.id === selected;
          return (
            <RadioGroupPrimitive.Item
              key={circle.id}
              value={circle.id}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-body outline-none transition-[border-color,opacity,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
                checked && 'border-[#7875ea]',
              )}
            >
              <span aria-hidden className={cn('size-4 shrink-0 rounded-full border-[1.5px] border-zinc-400', checked && 'border-[5px] border-[#7875ea]')} />
              <span className="min-w-0 flex-1 truncate">{circle.name}</span>
            </RadioGroupPrimitive.Item>
          );
        })}
      </RadioGroupPrimitive.Root>
      <Reveal gap={8}>{error && <InlineError>{error}</InlineError>}</Reveal>
      <Button
        type="submit"
        className={LIFE360_BUTTON}
        disabled={!selected || (!!pending && pending !== 'choose')}
        aria-disabled={pending === 'choose' || undefined}
        aria-busy={pending === 'choose' || undefined}
      >
        <BusyIcon busy={pending === 'choose'} />
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
  onOtherAddress: () => Promise<unknown>;
}

/** Admins: link the team's Life360 account (inside the Life360 card) — every step before "linked". */
export default function Life360LinkPanel({ view, status, emailPrefill, onOpenEmail, onCloseEmail, onOtherAddress, ...actions }: Life360LinkPanelProps) {
  const cancel = () => actions.onCancel();
  // Linking is refused while an archive edition is shown (423)
  const { readOnly } = useEdition();

  switch (view) {
    case 'unavailable':
      return <p className="text-xs text-muted-foreground">Life360 is niet ingesteld op de server (LIFE360_SESSION_KEY).</p>;
    case 'unlinked':
      return (
        <div className="flex flex-col gap-2.5" data-life360-state="unlinked">
          <p className="text-xs text-muted-foreground">Koppel het Life360-account dat in de team-cirkel zit. Iedereen in die cirkel verschijnt dan als eigen laag op de kaart.</p>
          <Button size="lg" className={cn('h-11 w-full text-sm', LIFE360_BUTTON)} disabled={readOnly} onClick={onOpenEmail}>
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
