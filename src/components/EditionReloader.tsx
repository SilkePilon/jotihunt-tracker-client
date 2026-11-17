import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useEdition } from '@/hooks/edition.hook';
import { editionReloadWait } from '@/lib/editions';
import useHiddenAreasStore from '@/stores/hiddenareas.store';
import usePromptQueueStore from '@/stores/prompt-queue.store';

const EDITION_TOAST_ID = 'edition-changed';

/**
 * Reloads the page when another edition is shown (e.g. an admin switched it) while the app is open: first a toast says
 * so, the reload follows 2 s later, or once the user has closed the form page or dialog they are in.
 */
export default function EditionReloader() {
  const { state } = useEdition();
  // The first known year; a ref, not state: setting state during render looped forever on a malformed answer
  const initial = useRef<number | undefined>(undefined);
  const year = typeof state?.shownYear === 'number' ? state.shownYear : undefined;
  // When the change was noticed; null while the shown edition is the one this page loaded
  const [changedAt, setChangedAt] = useState<number | null>(null);
  // A form page / docked form or a dialog / drawer is open (the prompt queue keeps count of both)
  const busy = usePromptQueueStore((s) => s.workHolds > 0 || s.openModals > 0);

  useEffect(() => {
    if (year === undefined) return;
    // Foxes hidden in another edition are visible again in this one
    useHiddenAreasStore.getState().syncEdition(year);
    if (initial.current === undefined) initial.current = year;
    else if (year !== initial.current) setChangedAt((at) => at ?? Date.now());
  }, [year]);

  useEffect(() => {
    if (changedAt === null) return;
    toast.info('Editie gewijzigd — app wordt herladen', {
      id: EDITION_TOAST_ID,
      duration: Infinity,
      description: busy ? 'Zodra je dit venster of formulier sluit.' : undefined,
    });
    const wait = editionReloadWait(changedAt, Date.now(), busy);
    if (wait === null) return;
    const timer = window.setTimeout(() => window.location.reload(), wait);
    return () => window.clearTimeout(timer);
  }, [changedAt, busy]);

  return null;
}
