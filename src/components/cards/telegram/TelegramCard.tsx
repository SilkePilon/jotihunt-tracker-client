import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadError from '@/components/LoadError';
import { Skeleton } from '@/components/ui/skeleton';
import type { LoadState } from '@/lib/load-state';
import { SWAP } from '@/lib/motion';
import { inlineLinkClass } from '@/components/tracker/styles';
import { useEdition } from '@/hooks/edition.hook';
import { cn } from '@/lib/utils';
import type { BotMessage, TelegramAdminStatus } from '@/types/Telegram';
import BotMessageTimeline from './BotMessageTimeline';
import TelegramLinkPanel, { type TelegramLinkActions } from './TelegramLinkPanel';

export interface TelegramAdminProps extends TelegramLinkActions {
  /** undefined while loading */
  status: TelegramAdminStatus | undefined;
  /** The status' first load failed */
  isError: boolean;
  onRetry: () => Promise<unknown> | unknown;
  /** Log the linked account out; resolves to true on success */
  onUnlink: () => Promise<boolean>;
}

interface TelegramCardProps {
  /** Newest first; undefined while loading */
  messages: BotMessage[] | undefined;
  /** The messages' first load: skeleton while loading, a retry when it failed */
  loadState: LoadState;
  onRetry: () => Promise<unknown> | unknown;
  /** Only for admins: linking and unlinking */
  admin?: TelegramAdminProps;
}

/** "Jotihunt-berichten": every @Jotihunt_bot message as a timeline; admins link the Telegram account here. */
export default function TelegramCard({ messages, loadState, onRetry, admin }: TelegramCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Unlinking is refused while an archive edition is shown (423)
  const { readOnly } = useEdition();
  const status = admin?.status;
  const linking = !!status && status.state !== 'linked';
  const linkedAccount = status?.state === 'linked' ? status.account : undefined;
  const footer = !admin ? null : !status ? (admin.isError ? 'error' : 'loading') : status.state === 'linked' ? 'linked' : null;

  async function unlink() {
    if (await admin?.onUnlink()) setConfirmOpen(false);
  }

  return (
    <div className="flex flex-col gap-3" data-telegram-card>
      {admin && status && linking && <TelegramLinkPanel status={status} onLink={admin.onLink} onCancel={admin.onCancel} onSubmitPassword={admin.onSubmitPassword} />}
      <AnimatePresence mode="wait" initial={false}>
        {loadState === 'loading' ? (
          <motion.div key="loading" {...SWAP} className="flex flex-col gap-3" role="status" aria-label="Berichten laden">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex gap-2.5">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </motion.div>
        ) : loadState === 'error' ? (
          <motion.div key="error" {...SWAP}>
            <LoadError message="Berichten konden niet worden geladen." onRetry={onRetry} />
          </motion.div>
        ) : messages && messages.length > 0 ? (
          <motion.div key="list" {...SWAP}>
            <BotMessageTimeline messages={messages} />
          </motion.div>
        ) : /* An admin who still has to link sees the link panel instead */
        !(linking && status?.state !== 'unavailable') ? (
          <motion.p key="empty" {...SWAP} className="text-center text-xs text-muted-foreground">
            Nog geen berichten van @Jotihunt_bot
          </motion.p>
        ) : null}
      </AnimatePresence>
      {/* The admin footer. The status' first load shows a footer-sized placeholder (most of the game it ends up "Luistert via …") or a retry */}
      <AnimatePresence mode="wait" initial={false}>
        {footer && (
          <motion.div key={footer} {...SWAP} className="flex flex-col gap-3">
            <div className="h-px bg-border" />
            {footer === 'error' && admin && <LoadError message="Telegram-status ophalen is mislukt." onRetry={admin.onRetry} />}
            {footer === 'loading' && (
              <div className="flex items-center justify-between gap-2 py-0.5" role="status" aria-label="Telegram-status laden">
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-3 w-16" />
              </div>
            )}
            {footer === 'linked' && status?.state === 'linked' && (
              <>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="min-w-0 truncate">
                    {status.connected === false ? 'Geen verbinding via' : 'Luistert via'} <b className="font-semibold text-foreground">{linkedAccount?.name ?? 'Telegram'}</b>
                  </span>
                  <button type="button" className={cn(inlineLinkClass, 'disabled:cursor-default disabled:text-muted-foreground disabled:no-underline')} disabled={readOnly} onClick={() => setConfirmOpen(true)}>
                    ontkoppelen
                  </button>
                </div>
                {status.connected === false && status.lastError && <p className="-mt-2 text-xs leading-snug text-muted-foreground desk:text-[11px]">{status.lastError}</p>}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <ConfirmDialog
        open={confirmOpen && status?.state === 'linked'}
        onOpenChange={setConfirmOpen}
        title="Telegram ontkoppelen?"
        description="De server logt uit bij Telegram. Tegenhunts worden dan niet meer automatisch gemeld, tot iemand opnieuw koppelt."
        confirmLabel="Ontkoppelen"
        destructive
        onConfirm={unlink}
      />
    </div>
  );
}
