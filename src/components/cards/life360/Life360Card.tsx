import { ReactNode, useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { inlineLinkClass } from '@/components/tracker/styles';
import { useEdition } from '@/hooks/edition.hook';
import { life360View } from '@/lib/life360';
import { cn } from '@/lib/utils';
import type { Life360AdminStatus, Life360Member } from '@/types/Life360';
import Life360LinkPanel, { type Life360LinkActions } from './Life360LinkPanel';
import Life360Linked from './Life360Linked';
import Life360Problem from './Life360Problem';

export interface Life360CardProps extends Life360LinkActions {
  /** undefined while loading */
  status: Life360AdminStatus | undefined;
  isError: boolean;
  /** For the members pill; undefined while loading */
  members: Life360Member[] | undefined;
  onRefresh: () => Promise<void>;
  /** Resolves to true once unlinked */
  onUnlink: () => Promise<boolean>;
  onFlyTo: (member: Life360Member) => void;
}

/** Admins: link the team's Life360 account and see whether the server can read the circle. */
export default function Life360Card({ status, isError, members, onRefresh, onUnlink, onFlyTo, ...actions }: Life360CardProps) {
  const [emailStep, setEmailStep] = useState(false);
  const [emailPrefill, setEmailPrefill] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Unlinking and "ververs" are refused while an archive edition is shown (423)
  const { readOnly } = useEdition();

  // Leaving "unlinked" (code sent, or linked elsewhere) closes the e-mail step, so a later unlink shows the button again
  const state = status?.state;
  const [previousState, setPreviousState] = useState(state);
  if (state !== previousState) {
    setPreviousState(state);
    if (state !== 'unlinked') setEmailStep(false);
  }

  /** "ander adres": cancel the pending login and reopen the e-mail step with the old address. */
  async function otherAddress() {
    const email = status && 'email' in status ? status.email : undefined;
    // Only after the cancel succeeded: a failed one (409) leaves the code step as it is
    if (!(await actions.onCancel())) return;
    if (email !== undefined) setEmailPrefill(email);
    setEmailStep(true);
  }

  async function unlink() {
    if (await onUnlink()) setConfirmOpen(false);
  }

  const view = life360View(status, isError, emailStep);
  let body: ReactNode;
  switch (view) {
    case 'loading':
      return null;
    case 'error':
      return <p className="text-xs text-muted-foreground">Life360-status ophalen is mislukt.</p>;
    case 'linked':
      body = status?.state === 'linked' && <Life360Linked status={status} members={members} readOnly={readOnly} onRefresh={onRefresh} onFlyTo={onFlyTo} />;
      break;
    case 'loggedOut':
    case 'paused':
      body = (status?.state === 'loggedOut' || status?.state === 'paused') && <Life360Problem status={status} onSendCode={actions.onSendCode} />;
      break;
    default:
      body = status && (
        <Life360LinkPanel
          view={view}
          status={status}
          emailPrefill={emailPrefill}
          onOpenEmail={() => setEmailStep(true)}
          onCloseEmail={() => setEmailStep(false)}
          onOtherAddress={() => void otherAddress()}
          {...actions}
        />
      );
  }

  const footer = status?.state === 'linked' || status?.state === 'paused' ? status : undefined;

  return (
    <div className="flex flex-col gap-3" data-life360-card>
      {body}
      {footer && (
        <>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="min-w-0 truncate">
              Leest via <b className="font-semibold text-foreground">{footer.email}</b>
            </span>
            <button type="button" className={cn(inlineLinkClass, 'shrink-0', 'disabled:cursor-default disabled:text-muted-foreground disabled:no-underline')} disabled={readOnly} onClick={() => setConfirmOpen(true)}>
              ontkoppelen
            </button>
          </div>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Life360 ontkoppelen?"
            description="De server vergeet de Life360-sessie. De Life360-laag verdwijnt van de kaart, tot iemand opnieuw koppelt."
            confirmLabel="Ontkoppelen"
            destructive
            onConfirm={unlink}
          />
        </>
      )}
    </div>
  );
}
