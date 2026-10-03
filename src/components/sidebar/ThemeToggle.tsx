import { MoonIcon, SunIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDarkMode } from '@/hooks/utils/darkmode.hook';
import useSettingsStore from '@/stores/settings.store';

/** Switches between light and dark mode; the first click overrides the system preference. */
export default function ThemeToggle() {
  const isDarkMode = useDarkMode();
  const setDarkMode = useSettingsStore((state) => state.setDarkMode);
  const label = isDarkMode ? 'Lichte modus' : 'Donkere modus';

  return (
    <Button variant="outline" size="sm" aria-label={label} title={label} onClick={() => setDarkMode(!isDarkMode)}>
      {isDarkMode ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
