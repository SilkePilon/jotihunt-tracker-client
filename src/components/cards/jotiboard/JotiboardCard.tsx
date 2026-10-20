import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { EllipsisIcon, XIcon } from 'lucide-react';
import AutoHeight from '@/components/motion/AutoHeight';
import Reveal from '@/components/motion/Reveal';
import { Button } from '@/components/ui/button';
import { useEdition } from '@/hooks/edition.hook';
import { hasImports, jotiboardView } from '@/lib/jotiboard';
import { SWAP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { JotiboardStatus } from '@/types/Jotiboard';
import JotiboardActions from './JotiboardActions';
import JotiboardLoginForm from './JotiboardLoginForm';
import JotiboardLogo from './JotiboardLogo';
import { JotiboardLinked, JotiboardLoggedOutHeader } from './JotiboardStatusView';
import { JOTIBOARD_BUTTON } from './styles';

export interface JotiboardCardProps {
  status: JotiboardStatus | undefined;
  isError: boolean;
  /** Resolve to an error text, or null when it worked */
  onLink: (username: string, password: string) => Promise<string | null>;
  onSetSync: (enabled: boolean) => Promise<void>;
  /** Resolve to true when done */
  onUnlink: () => Promise<boolean>;
  onPurge: () => Promise<boolean>;
}

/** Admins: link Jotiboard, toggle auto-sync, unlink / delete imported data (mockups linked A, link-flow A, B3). */
export default function JotiboardCard({ status, isError, onLink, onSetSync, onUnlink, onPurge }: JotiboardCardProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  // Linking, the sync switch, unlink and delete are refused while an archive edition is shown (423)
  const { readOnly } = useEdition();
  const view = jotiboardView(status, isError);

  // Leaving "unlinked" closes the login form, so a later unlink shows the button again
  const [previousView, setPreviousView] = useState(view);
  if (view !== previousView) {
    setPreviousView(view);
    if (view !== 'unlinked') setFormOpen(false);
  }

  const counts = status && 'counts' in status ? status.counts : { pins: 0, hints: 0 };
  const linked = status?.state === 'linked' ? status : null;
  const username = status && 'username' in status ? status.username : null;
  const canPurge = hasImports(counts);
  const canUnlink = !!username;
  const showMenu = canPurge || canUnlink;

  // The ⋯ block only closes when it can no longer show or the account changes, not on every syncing ↔ failing flip of a poll
  // (a successful unlink / purge closes it via onDone)
  const [previousUsername, setPreviousUsername] = useState(username);
  if (username !== previousUsername) {
    setPreviousUsername(username);
    setActionsOpen(false);
  }
  if (actionsOpen && (!showMenu || readOnly)) setActionsOpen(false);

  if (view === 'loading') return null;
  if (view === 'error') return <p className="text-xs text-muted-foreground">Jotiboard-status ophalen is mislukt.</p>;
  if (view === 'unavailable') return <p className="text-xs text-muted-foreground">Jotiboard is niet ingesteld op de server (JOTIBOARD_SESSION_KEY).</p>;

  const linkedView = view === 'syncing' || view === 'failing' || view === 'paused' ? view : null;
  // One scene for every linked state: JotiboardLinked stays mounted, so its badge pops and its switch's thumb slides
  const scene = view === 'unlinked' ? (formOpen ? 'form' : 'unlinked') : linkedView ? 'linked' : view;

  return (
    <div className="flex flex-col gap-3" data-jotiboard-card>
      <AutoHeight scene={scene} className="-m-1" innerClassName="p-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={scene} {...SWAP}>
            {scene === 'unlinked' && (
              <div className="flex flex-col gap-2.5">
                <p className="text-xs text-muted-foreground">Koppel het Jotiboard-account. Pins en opgeloste hints van Jotiboard komen dan automatisch in de tracker.</p>
                <Button size="lg" className={cn('h-11 w-full rounded-lg text-sm font-semibold', JOTIBOARD_BUTTON)} disabled={readOnly} onClick={() => setFormOpen(true)}>
                  <JotiboardLogo className="size-5" />
                  Koppel Jotiboard
                </Button>
              </div>
            )}
            {scene === 'form' && <JotiboardLoginForm submitLabel="Koppelen" onSubmit={onLink} onCancel={() => setFormOpen(false)} />}
            {scene === 'linked' && linked && linkedView && <JotiboardLinked status={linked} view={linkedView} disabled={readOnly} onSetSync={onSetSync} />}
            {view === 'loggedOut' && username && (
              <div className="flex flex-col items-center gap-2">
                <JotiboardLoggedOutHeader />
                <JotiboardLoginForm fixedUsername={username} submitLabel="Opnieuw inloggen" onSubmit={onLink} hideNote />
                <p className="-mt-1 text-[11px] text-muted-foreground">
                  als <b className="font-semibold text-foreground">{username}</b>
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </AutoHeight>

      {/* The whole footer folds in/out, so the ⋯ block's own exit isn't cut off when the menu goes */}
      <Reveal gap={12}>
        {showMenu && (
          <div className="flex flex-col gap-3">
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={username ?? ''} className="min-w-0 truncate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  {username && (
                    <>
                      Leest via <b className="font-semibold text-foreground">{username}</b>
                    </>
                  )}
                </motion.span>
              </AnimatePresence>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className={cn('size-[26px] rounded-full', actionsOpen && 'bg-zinc-200 dark:bg-zinc-700')}
                aria-label={actionsOpen ? 'Acties sluiten' : 'Acties'}
                aria-expanded={actionsOpen}
                disabled={readOnly}
                onClick={() => setActionsOpen((open) => !open)}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={actionsOpen ? 'close' : 'open'} className="grid place-items-center" {...SWAP}>
                    {actionsOpen ? <XIcon className="size-4" /> : <EllipsisIcon className="size-4" />}
                  </motion.span>
                </AnimatePresence>
              </Button>
            </div>
            <Reveal gap={12}>
              {actionsOpen && <JotiboardActions counts={counts} canUnlink={canUnlink} canPurge={canPurge} onUnlink={onUnlink} onPurge={onPurge} onDone={() => setActionsOpen(false)} />}
            </Reveal>
          </div>
        )}
      </Reveal>
    </div>
  );
}
