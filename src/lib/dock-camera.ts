import type { Map as MaplibreMap } from 'maplibre-gl';
import useSidebarStore from '@/stores/sidebar.store';
import { DOCK_GAP, phoneMapPadding, type CameraPadding } from './sheet-snaps';

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface MapSize {
  width: number;
  height: number;
}

/** The screen point the camera centre sits at with this padding (the middle of the padded area). */
export function paddedCentre({ width, height }: MapSize, padding: CameraPadding): [number, number] {
  return [padding.left + (width - padding.left - padding.right) / 2, padding.top + (height - padding.top - padding.bottom) / 2];
}

/**
 * Phones: whether the point a docked card belongs to is hidden (under the card or sheet, above the safe top, or outside
 * the padded sides), so the camera has to bring it into view. A visible point stays where it is.
 */
export function pointHiddenByDock(point: ScreenPoint, size: MapSize, padding: CameraPadding, safeTop: number): boolean {
  return point.x < padding.left || point.x > size.width - padding.right || point.y < Math.max(safeTop, padding.top) || point.y > size.height - padding.bottom - DOCK_GAP;
}

/**
 * Phones: the camera padding for the snap the sheet is at (or heading to) and the docked card; undefined before the
 * sheet measured (desktop, the HQ wall).
 */
export function currentPhonePadding(mapHeight = window.innerHeight): CameraPadding | undefined {
  const { sheetSnapHeights, sheetSnap, dockCardHeight } = useSidebarStore.getState();
  return sheetSnapHeights ? phoneMapPadding({ sheet: sheetSnapHeights[sheetSnap], card: dockCardHeight, mapHeight }) : undefined;
}

/**
 * Apply new camera padding without anything moving on screen: the centre becomes whatever is now under the middle of
 * the new padded area (padding alone would slide the view to put the old centre there).
 */
export function setPaddingInPlace(map: MaplibreMap, padding: CameraPadding): void {
  const container = map.getContainer();
  const center = map.unproject(paddedCentre({ width: container.clientWidth, height: container.clientHeight }, padding));
  map.jumpTo({ center, padding });
}
