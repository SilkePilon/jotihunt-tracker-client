import { useState } from 'react';
import { Loader2Icon, RotateCwIcon, WifiOffIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Invite / herstel page when the link couldn't be checked (no answer, server error): not "expired", but try again. */
export default function UnreachableCard({ onRetry }: { onRetry: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);

  async function retry() {
    setBusy(true);
    try {
      await onRetry();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="alert" className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border bg-card p-7 text-center shadow-lg">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
        <WifiOffIcon className="size-5 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-medium tracking-tight">Server niet bereikbaar</h2>
      <p className="text-sm/relaxed text-muted-foreground">Controleer je verbinding en probeer opnieuw. Je link is niet verlopen.</p>
      <Button variant="outline" className="mt-1 w-full" onClick={() => void retry()} disabled={busy} aria-busy={busy}>
        {busy ? <Loader2Icon className="animate-spin" /> : <RotateCwIcon />}
        Opnieuw proberen
      </Button>
    </div>
  );
}
