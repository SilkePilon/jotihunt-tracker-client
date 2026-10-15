import { MoonStarIcon, SunIcon } from 'lucide-react';
import { useDarkMode } from '@/hooks/utils/darkmode.hook';
import useSettingsStore from '@/stores/settings.store';
import { cn } from '@/lib/utils';
import { HEADER_BUTTON } from './header-button';

/** Both icons stay mounted and cross-swap: the leaving one turns away and shrinks, the other turns in. */
const ICON = 'absolute size-[18px] transition-[rotate,scale,opacity] duration-[350ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none';

/** Switches between light and dark mode; the first click overrides the system preference. */
export default function ThemeToggle({ className }: { className?: string }) {
  const isDarkMode = useDarkMode();
  const setDarkMode = useSettingsStore((state) => state.setDarkMode);
  const label = isDarkMode ? 'Lichte modus' : 'Donkere modus';

  return (
    <button type="button" aria-label={label} title={label} onClick={() => setDarkMode(!isDarkMode)} className={cn(HEADER_BUTTON, className)}>
      <MoonStarIcon className={cn(ICON, isDarkMode && 'scale-40 rotate-90 opacity-0')} />
      <SunIcon className={cn(ICON, !isDarkMode && 'scale-40 -rotate-90 opacity-0')} />
    </button>
  );
}
