import { useState } from 'react';
import { Loader2Icon, RotateCwIcon, WifiOffIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AUTH_CARD } from '@/components/auth/auth-card';
import { cn } from '@/lib/utils';
import { busyProps } from '@/lib/busy';

/** Invite / herstel page when the link couldn't be checked (no answer, server error): not "expired", but try again. */
export default function UnreachableCard({ onRetry }: { onRetry: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);

  async function retry() {
    if (busy) return;
    setBusy(true);
    try {
      await onRetry();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="alert" className={cn(AUTH_CARD, 'flex w-full max-w-sm flex-col items-center gap-3 p-7 text-center')}>
      <div className="flex size-10 items-center justify-center rounded-lg bg-beheer-row-high">
        <WifiOffIcon className="size-5 text-muted-foreground" />
      </div>
      <h1 className="text-lg font-bold tracking-tight">Server niet bereikbaar</h1>
      <p className="text-sm/relaxed text-muted-foreground">Controleer je verbinding en probeer opnieuw. Je link is niet verlopen.</p>
      <Button variant="outline" className="mt-1 w-full" onClick={() => void retry()} {...busyProps(busy)}>
        {busy ? <Loader2Icon className="animate-spin" /> : <RotateCwIcon />}
        Opnieuw proberen
      </Button>
    </div>
  );
}
