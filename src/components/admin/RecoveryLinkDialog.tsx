import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import CopyButton from '@/components/CopyButton';
import { apiErrorMessage } from '@/lib/api-error';
import { SWAP } from '@/lib/motion';
import type { User } from '@/types/User';

interface RecoveryLinkDialogProps {
  user: User | null;
  onClose: () => void;
  createLink: (id: string) => Promise<{ url: string; expiresAt: string }>;
}

/** The outcome of making a link, tagged with the user it was made for (so a stale one is never shown). */
type LinkResult = { userId: string } & ({ link: { url: string; expiresAt: string } } | { error: string });

/** Shows a fresh one-time herstel-link for `user` (made when the dialog opens). */
export default function RecoveryLinkDialog({ user, onClose, createLink }: RecoveryLinkDialogProps) {
  const [result, setResult] = useState<LinkResult | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const userId = user._id;
    createLink(userId)
      .then((link) => !cancelled && setResult({ userId, link }))
      .catch((failure) => !cancelled && setResult({ userId, error: apiErrorMessage(failure, 'Herstel-link maken is mislukt, probeer het opnieuw.') }));
    return () => {
      cancelled = true;
    };
  }, [user, createLink]);

  const current = user && result?.userId === user._id ? result : null;
  const link = current && 'link' in current ? current.link : null;
  const error = current && 'error' in current ? current.error : null;
  const until = link ? new Date(link.expiresAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Herstel-link voor {user?.name}</DialogTitle>
          <DialogDescription>Hiermee maakt {user?.name} een nieuwe passkey en logt meteen in.</DialogDescription>
        </DialogHeader>
        <AnimatePresence mode="wait" initial={false}>
          {error && (
            <motion.p key="error" role="alert" className="text-xs font-medium text-destructive" {...SWAP}>
              {error}
            </motion.p>
          )}
          {!error && !link && (
            <motion.div key="loading" {...SWAP}>
              <Skeleton className="h-9 w-full" />
            </motion.div>
          )}
          {link && (
            <motion.div key="link" className="flex flex-col gap-2" {...SWAP}>
              <div className="flex gap-2">
                <Input readOnly value={link.url} className="font-mono text-xs" onFocus={(event) => event.target.select()} />
                <CopyButton value={link.url} label="Link" size="icon" />
              </div>
              <p className="text-xs text-muted-foreground">Geldig tot {until}, werkt één keer.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
