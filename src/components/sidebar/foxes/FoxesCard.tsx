import FoxStatusBar from './FoxStatusBar';
import { useSidebarFoxes } from './useSidebarFoxes';

/** Collapsed "Vossen" header: the mini status bar. */
export function FoxesSummary() {
  const foxes = useSidebarFoxes();
  if (!foxes || foxes.length === 0) return null;
  return <FoxStatusBar foxes={foxes} size="mini" />;
}
