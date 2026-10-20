import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { PauseIcon } from 'lucide-react';
import FadeText from '@/components/motion/FadeText';
import Reveal from '@/components/motion/Reveal';
import CookieBadge from '@/components/tracker/CookieBadge';
import { Switch } from '@/components/ui/switch';
import { useNow } from '@/hooks/now.hook';
import { jotiboardSyncLine } from '@/lib/jotiboard';
import { POP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { JotiboardLinkedStatus } from '@/types/Jotiboard';
import { JOTIBOARD_BLOCK } from './styles';

type LinkedView = 'syncing' | 'failing' | 'paused';

const TITLE: Record<LinkedView, string> = { syncing: 'Synchroniseert', failing: 'Synchroniseert', paused: 'Gepauzeerd' };

/**
 * Linked (mockup linked-state A): big cookie, title, sync line, "Automatisch synchroniseren" switch in a grey pill.
 * Stays mounted across syncing / failing / paused: only the badge pops, the texts fade and the switch's thumb slides.
 */
export function JotiboardLinked({ status, view, disabled, onSetSync }: { status: JotiboardLinkedStatus; view: LinkedView; disabled?: boolean; onSetSync: (enabled: boolean) => Promise<void> }) {
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
      <div className="grid size-[72px] place-items-center">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={view} className="col-start-1 row-start-1" {...POP}>
            {view === 'paused' ? <CookieBadge tone="neutral" size={72} glyph={<PauseIcon className="size-7 fill-current" />} /> : <CookieBadge tone={view === 'failing' ? 'warn' : 'ok'} size={72} />}
          </motion.div>
        </AnimatePresence>
      </div>
      <FadeText swapKey={TITLE[view]} className="mt-2 text-base font-bold">
        {TITLE[view]}
      </FadeText>
      <Reveal gap={2}>{view === 'failing' && status.lastError && <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{status.lastError}</p>}</Reveal>
      {/* Keyed on the view, so the ticking "… geleden" doesn't fade every second */}
      <FadeText swapKey={view} className="text-xs text-muted-foreground tabular-nums">
        {jotiboardSyncLine(status, now)}
      </FadeText>
      <label className={cn('mt-3 flex w-full cursor-pointer items-center justify-between gap-3 px-2.5 py-2', JOTIBOARD_BLOCK)}>
        <span className="text-[13px] font-medium">Automatisch synchroniseren</span>
        <Switch checked={status.syncEnabled} disabled={busy || disabled} onCheckedChange={(checked) => void toggle(checked)} className="data-[state=checked]:bg-green-600" />
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
