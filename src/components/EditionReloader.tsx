import { useEffect, useRef } from 'react';
import { useEdition } from '@/hooks/edition.hook';

/** Reloads the page when another edition is shown (e.g. an admin switched it) while the app is open. */
export default function EditionReloader() {
  const { state } = useEdition();
  // The first known year; a ref, not state: setting state during render looped forever on a malformed answer
  const initial = useRef<number | undefined>(undefined);
  const year = typeof state?.shownYear === 'number' ? state.shownYear : undefined;

  useEffect(() => {
    if (year === undefined) return;
    if (initial.current === undefined) initial.current = year;
    else if (year !== initial.current) window.location.reload();
  }, [year]);

  return null;
}
