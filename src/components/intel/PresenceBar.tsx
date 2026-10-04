import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { formatClock } from '@/lib/format';
import type { PresenceEntry } from '@/types/Intel';
import PresenceAvatars from './PresenceAvatars';

interface PresenceBarProps {
  /** The other users who have this open */
  entries: PresenceEntry[];
  /** Since when one of them has claimed it, for "bezig sinds 14:04" */
  claimedSince?: string;
}

const signature = (entries: PresenceEntry[]) => entries.map((entry) => `${entry.userId}:${entry.name}`).join('|');

/** "Sanne kijkt hier ook naar", "Sanne en Daan kijken …" or "Sanne en 2 anderen kijken …" */
function Names({ entries }: { entries: PresenceEntry[] }) {
  const first = <b>{entries[0].name}</b>;
  if (entries.length === 1) return <>{first} kijkt hier ook naar</>;
  if (entries.length === 2) {
    return (
      <>
        {first} en <b>{entries[1].name}</b> kijken hier ook naar
      </>
    );
  }
  return (
    <>
      {first} en {entries.length - 1} anderen kijken hier ook naar
    </>
  );
}

/** An amber bar that says who else has this item open; nothing when you are alone */
export default function PresenceBar({ entries, claimedSince }: PresenceBarProps) {
  const reducedMotion = useReducedMotion();
  // Keep the last names on screen while the bar animates out (the list is empty by then)
  const [shown, setShown] = useState(entries);
  if (entries.length > 0 && signature(entries) !== signature(shown)) setShown(entries);
  const list = entries.length > 0 ? entries : shown;

  const hidden = { height: 0, opacity: 0 };
  return (
    <AnimatePresence initial={false}>
      {entries.length > 0 && (
        <motion.div
          key="presence"
          role="status"
          className="shrink-0 overflow-hidden"
          initial={reducedMotion ? false : hidden}
          animate={{ height: 'auto', opacity: 1 }}
          exit={reducedMotion ? undefined : hidden}
          transition={{ duration: reducedMotion ? 0 : 0.15 }}
        >
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-200">
            <PresenceAvatars entries={list} />
            <span className="min-w-0">
              <Names entries={list} />
              {claimedSince && <> · bezig sinds {formatClock(claimedSince)}</>}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
