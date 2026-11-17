import { useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { NewspaperIcon } from 'lucide-react';
import { useArticles } from '@/hooks/articles.hook';
import { useReadState } from '@/hooks/read-state.hook';
import { buildIntelItems, unreadCount } from '@/lib/intel-window';
import { POP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { shortcutTitle } from '@/lib/shortcuts';
import useIntelStore from '@/stores/intel.store';
import useSettingsStore from '@/stores/settings.store';
import { HEADER_BUTTON, HEADER_BUTTON_START } from './header-button';

/** The window's name; the tooltip adds its keyboard shortcut (Layout.tsx) while shortcuts are on */
export const INTEL_LABEL = 'Intel';

/**
 * Laptop: the left half of the sidebar header's joined button group, opening the Intel window. A dot pops in while news
 * or an opdracht is unread (the same read state as the window's tabs).
 */
export default function IntelButton() {
  const openIntel = useIntelStore((state) => state.openIntel);
  const shortcutsEnabled = useSettingsStore((state) => state.shortcutsEnabled);
  const { articles } = useArticles();
  const { readState } = useReadState();
  const unread = useMemo(() => unreadCount(buildIntelItems({ articles, readState })) > 0, [articles, readState]);

  return (
    <button
      type="button"
      title={shortcutTitle(INTEL_LABEL, 'I', shortcutsEnabled)}
      aria-keyshortcuts={shortcutsEnabled ? 'i' : undefined}
      onClick={() => openIntel()}
      className={cn(HEADER_BUTTON, HEADER_BUTTON_START, 'rounded-l-lg rounded-r-(--radius-segment) [&_svg]:size-[18px]')}
    >
      <NewspaperIcon aria-hidden />
      <span className="sr-only">
        {INTEL_LABEL}
        {unread && ', ongelezen'}
      </span>
      <AnimatePresence>
        {unread && <motion.span key="dot" {...POP} aria-hidden className="absolute top-1 right-1 size-[7px] rounded-full bg-primary-fill" />}
      </AnimatePresence>
    </button>
  );
}
