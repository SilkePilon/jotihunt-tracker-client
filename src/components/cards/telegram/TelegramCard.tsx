import { useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { inlineLinkClass } from '@/components/tracker/styles';
import type { BotMessage, TelegramAdminStatus } from '@/types/Telegram';
import BotMessageTimeline from './BotMessageTimeline';
import TelegramLinkPanel, { type TelegramLinkActions } from './TelegramLinkPanel';

export interface TelegramAdminProps extends TelegramLinkActions {
  /** undefined while loading */
  status: TelegramAdminStatus | undefined;
  /** Log the linked account out; resolves to true on success */
  onUnlink: () => Promise<boolean>;
}

interface TelegramCardProps {
  /** Newest first; undefined while loading */
  messages: BotMessage[] | undefined;
  /** Only for admins: linking and unlinking */
  admin?: TelegramAdminProps;
}

/** "Jotihunt-berichten": every @Jotihunt_bot message as a timeline; admins link the Telegram account here. */
export default function TelegramCard({ messages, admin }: TelegramCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const status = admin?.status;
  const linking = !!status && status.state !== 'linked';
  const linkedAccount = status?.state === 'linked' ? status.account : undefined;

  async function unlink() {
    if (await admin?.onUnlink()) setConfirmOpen(false);
  }

  return (
    <div className="flex flex-col gap-3" data-telegram-card>
      {admin && status && linking && <TelegramLinkPanel status={status} onLink={admin.onLink} onCancel={admin.onCancel} onSubmitPassword={admin.onSubmitPassword} />}
      {messages && messages.length > 0 && <BotMessageTimeline messages={messages} />}
      {/* An admin who still has to link sees the link panel instead */}
      {messages?.length === 0 && !(linking && status?.state !== 'unavailable') && (
        <p className="text-center text-xs text-muted-foreground">Nog geen berichten van @Jotihunt_bot</p>
      )}
      {admin && status?.state === 'linked' && (
        <>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="min-w-0 truncate">
              {status.connected === false ? 'Geen verbinding via' : 'Luistert via'} <b className="font-semibold text-foreground">{linkedAccount?.name ?? 'Telegram'}</b>
            </span>
            <button type="button" className={inlineLinkClass} onClick={() => setConfirmOpen(true)}>
              ontkoppelen
            </button>
          </div>
          {status.connected === false && status.lastError && <p className="-mt-2 text-[11px] leading-snug text-muted-foreground">{status.lastError}</p>}
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Telegram ontkoppelen?"
            description="De server logt uit bij Telegram. Tegenhunts worden dan niet meer automatisch gemeld, tot iemand opnieuw koppelt."
            confirmLabel="Ontkoppelen"
            destructive
            onConfirm={unlink}
          />
        </>
      )}
    </div>
  );
}
