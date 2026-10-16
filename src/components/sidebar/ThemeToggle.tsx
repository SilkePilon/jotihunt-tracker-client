import { useState, type MouseEvent } from 'react';
import { MoonStarIcon, SunIcon } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { useDarkMode } from '@/hooks/utils/darkmode.hook';
import useSettingsStore from '@/stores/settings.store';
import { cn } from '@/lib/utils';
import { THROW_MS, shouldFlashbang } from '@/lib/flashbang';
import { playFlashbangSound, preloadFlashbangSound } from '@/lib/flashbang-sound';
import { HEADER_BUTTON } from './header-button';
import Flashbang from './Flashbang';

/** Both icons stay mounted and cross-swap: the leaving one turns away and shrinks, the other turns in. */
const ICON = 'absolute size-[18px] transition-[rotate,scale,opacity] duration-[350ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none';

/** Switches between light and dark mode; the first click overrides the system preference. Dark → light throws a flashbang. */
export default function ThemeToggle({ className }: { className?: string }) {
  const isDarkMode = useDarkMode();
  const setDarkMode = useSettingsStore((state) => state.setDarkMode);
  const soundMuted = useSettingsStore((state) => state.soundMuted);
  const reducedMotion = useReducedMotion() ?? false;
  const [throwFrom, setThrowFrom] = useState<{ x: number; y: number }>();
  const label = isDarkMode ? 'Lichte modus' : 'Donkere modus';

  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    if (throwFrom) return;
    if (!shouldFlashbang({ isDarkMode, reducedMotion })) {
      setDarkMode(!isDarkMode);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setThrowFrom({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    if (!soundMuted) playFlashbangSound(THROW_MS);
  };

  // The view transition snapshots the page right after this; the body class must flip in the same frame
  const switchToLight = () => {
    document.body.classList.remove('dark');
    setDarkMode(false);
  };

  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={toggle}
        onPointerEnter={isDarkMode && !soundMuted ? preloadFlashbangSound : undefined}
        onFocus={isDarkMode && !soundMuted ? preloadFlashbangSound : undefined}
        className={cn(HEADER_BUTTON, className)}
      >
        <MoonStarIcon className={cn(ICON, isDarkMode && 'scale-40 rotate-90 opacity-0')} />
        <SunIcon className={cn(ICON, !isDarkMode && 'scale-40 -rotate-90 opacity-0')} />
      </button>
      {throwFrom && <Flashbang from={throwFrom} onSwitch={switchToLight} onDone={() => setThrowFrom(undefined)} />}
    </>
  );
}
