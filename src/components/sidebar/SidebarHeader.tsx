import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Settings from '@/components/Settings';
import { cn } from '@/lib/utils';
import { useAppConfig } from '@/hooks/app-config.hook';
import { useIsMobile } from '@/hooks/media.hook';
import { apiAssetUrl } from '@/lib/app-config';
import { useStartTour } from '@/components/tour/useTour';
import { SWAP_TRANSITION } from '@/lib/motion';
import EditionBadge from './EditionBadge';
import ThemeToggle from './ThemeToggle';
import IntelButton from './IntelButton';
import { HEADER_BUTTON_START } from './header-button';

/** `className`: e.g. the phone menu's rounded-3xl, to match its menu cards (which have no ring, so neither does the header then) */
export default function SidebarHeader({ className }: { className?: string }) {
  const startTour = useStartTour();
  const { logoUrl, groupName } = useAppConfig();
  const logo = apiAssetUrl(logoUrl);
  // The Intel window is laptop-only (phones have the Hints page); there it leads the group
  const isMobile = useIsMobile();

  return (
    <div className={cn(!className && 'card', 'flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-card-foreground', className)}>
      <GroupLogo src={logo} groupName={groupName} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold leading-tight">Jotihunt Tracker</p>
        {groupName && <p className="truncate text-xs text-muted-foreground">{groupName}</p>}
      </div>
      <EditionBadge />
      {/* Joined tonal group: 2px seam, 12px outer and 6px inner corners */}
      <div className="flex shrink-0 gap-0.5">
        {!isMobile && <IntelButton />}
        <ThemeToggle className={isMobile ? cn(HEADER_BUTTON_START, 'rounded-l-lg rounded-r-[6px]') : 'rounded-[6px]'} />
        <Settings onReplayTour={() => startTour('replay')} />
      </div>
    </div>
  );
}

/**
 * The group's logo; decorative (alt=""), the name is right next to it. A missing or broken logo fades over to the
 * group's initial on a soft orange tile instead of a broken-image icon.
 */
function GroupLogo({ src, groupName }: { src?: string; groupName?: string | null }) {
  // The src that failed: a new logo URL gets a fresh try
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = !src || failedSrc === src;
  const initial = (groupName?.trim().charAt(0) || 'J').toUpperCase();
  return (
    <span className="relative size-8 shrink-0">
      {!failed && <img src={src} alt="" className="size-8 rounded-md" onError={() => setFailedSrc(src)} />}
      <AnimatePresence initial={false}>
        {failed && (
          <motion.span
            key="initial"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SWAP_TRANSITION}
            className="absolute inset-0 grid place-items-center rounded-md bg-primary-container text-sm font-bold text-on-primary-container"
          >
            {initial}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
