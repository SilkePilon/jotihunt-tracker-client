import { useState } from 'react';
import { PauseIcon } from 'lucide-react';
import CookieBadge from '@/components/tracker/CookieBadge';
import { Switch } from '@/components/ui/switch';
import { useNow } from '@/hooks/now.hook';
import { jotiboardSyncLine, type JotiboardView } from '@/lib/jotiboard';
import { cn } from '@/lib/utils';
import type { JotiboardLinkedStatus } from '@/types/Jotiboard';
import { JOTIBOARD_BLOCK } from './styles';

const TITLE: Record<'syncing' | 'failing' | 'paused', string> = { syncing: 'Synchroniseert', failing: 'Synchroniseert', paused: 'Gepauzeerd' };

/** Linked (mockup linked-state A): big cookie, title, sync line, "Automatisch synchroniseren" switch in a grey pill. */
export function JotiboardLinked({ status, view, onSetSync }: { status: JotiboardLinkedStatus; view: 'syncing' | 'failing' | 'paused'; onSetSync: (enabled: boolean) => Promise<void> }) {
  const now = useNow(true);
  const [busy, setBusy] = useState(false);

  async function toggle(enabled: boolean) {
    setBusy(true);
    try {
      await onSetSync(enabled);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-0.5 pt-1 text-center" data-jotiboard-state={view}>
      {view === 'paused' ? <CookieBadge tone="neutral" size={72} glyph={<PauseIcon className="size-7 fill-current" />} /> : <CookieBadge tone={view === 'failing' ? 'warn' : 'ok'} size={72} />}
      <p className="mt-2 text-base font-bold">{TITLE[view]}</p>
      {view === 'failing' && status.lastError && <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{status.lastError}</p>}
      <p className="text-xs text-muted-foreground tabular-nums">{jotiboardSyncLine(status, now)}</p>
      <label className={cn('mt-3 flex w-full cursor-pointer items-center justify-between gap-3 px-2.5 py-2', JOTIBOARD_BLOCK)}>
        <span className="text-[13px] font-medium">Automatisch synchroniseren</span>
        <Switch checked={status.syncEnabled} disabled={busy} onCheckedChange={(checked) => void toggle(checked)} className="data-[state=checked]:bg-green-600" />
      </label>
    </div>
  );
}

/** Logged out: amber cookie, "Uitgelogd", the password field and "Opnieuw inloggen" (rendered by the card). */
export function JotiboardLoggedOutHeader() {
  return (
    <div className="flex flex-col items-center gap-0.5 pt-1 text-center" data-jotiboard-state="loggedOut">
      <CookieBadge tone="warn" size={72} />
      <p className="mt-2 text-base font-bold">Uitgelogd</p>
      <p className="text-xs text-muted-foreground">Jotiboard heeft de sessie beëindigd. Wat al geïmporteerd is blijft staan.</p>
    </div>
  );
}

export type { JotiboardView };
