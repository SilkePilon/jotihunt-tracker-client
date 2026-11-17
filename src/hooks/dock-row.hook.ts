import { useShallow } from 'zustand/react/shallow';
import { useLandscapePhone } from '@/hooks/media.hook';
import { rowDock } from '@/lib/sheet-snaps';
import useSidebarStore from '@/stores/sidebar.store';
import useViewportStore from '@/stores/viewport.store';

/**
 * Phones: whether the popup dock is a row, the card beside the tile stack (see rowDock). Decided by the room above the
 * sheet's settled height (not its live drag height, so a drag doesn't flip the layout back and forth); held sideways
 * the dock stands on the bottom safe area right of the sheet column.
 */
export function useDockRow(): boolean {
  const { visibleH, safeTop, safeBottom } = useViewportStore(useShallow((s) => ({ visibleH: s.visibleH, safeTop: s.safeTop, safeBottom: s.safeBottom })));
  const sideways = useLandscapePhone();
  const sheetHeight = useSidebarStore((s) => s.sheetHeight);
  return rowDock({ visibleH, safeTop, base: sideways ? safeBottom : sheetHeight });
}
