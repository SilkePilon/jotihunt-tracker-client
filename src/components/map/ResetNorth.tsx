import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useControl, useMap, type ControlPosition } from 'react-map-gl/maplibre';
import type { IControl } from 'maplibre-gl';
import { AnimatePresence, motion } from 'motion/react';
import { CompassIcon } from 'lucide-react';
import { isRotated } from '@/lib/map-view';
import { POP } from '@/lib/motion';
import { keepFocusAfterReset, RESET_NORTH_LABEL, resetNorth } from '@/lib/reset-north';
import useMapRotationStore from '@/stores/map-rotation.store';

/** Inside the map: keeps useMapRotationStore up to date while the map turns or tilts (touch twist, orbit, 3D tilt). */
export function MapRotationTracker() {
  const map = useMap().current?.getMap();
  useEffect(() => {
    if (!map) return;
    const update = () => useMapRotationStore.getState().setRotated(isRotated(map.getBearing(), map.getPitch()));
    update();
    map.on('rotate', update);
    map.on('pitch', update);
    return () => {
      map.off('rotate', update);
      map.off('pitch', update);
      useMapRotationStore.getState().setRotated(false);
    };
  }, [map]);
  return null;
}

/** An empty control-group box in MapLibre's control corner; the tile is portalled into it (as MapLayersControl). */
class PortalControl implements IControl {
  readonly container = document.createElement('div');

  onAdd() {
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    // Empty until the map is turned: no margin gap in the stack
    this.container.style.display = 'none';
    return this.container;
  }

  onRemove() {
    this.container.remove();
  }

  /** Hidden while empty: no margin gap in the stack */
  setShown(shown: boolean) {
    this.container.style.display = shown ? '' : 'none';
  }
}

/**
 * Desktop: a compass tile in the map's control stack that pops in while the map is turned or tilted and puts it back to
 * north-up and flat (the zoom control has no compass, and an orbit can't otherwise be undone exactly).
 */
export function ResetNorthControl({ position = 'bottom-right' }: { position?: ControlPosition }) {
  const control = useControl(() => new PortalControl(), { position });
  const map = useMap().current?.getMap();
  const rotated = useMapRotationStore((state) => state.rotated);
  // The box stays in the stack until the tile's exit animation has finished
  const [exited, setExited] = useState(!rotated);
  if (rotated && exited) setExited(false);
  useLayoutEffect(() => {
    control.setShown(!exited);
  }, [control, exited]);

  return createPortal(
    <AnimatePresence initial={false} onExitComplete={() => setExited(true)}>
      {rotated && (
        <motion.button
          key="north"
          type="button"
          aria-label={RESET_NORTH_LABEL}
          title={RESET_NORTH_LABEL}
          {...POP}
          onClick={(event) => {
            if (!map) return;
            keepFocusAfterReset(event.currentTarget, map);
            resetNorth(map);
          }}
          className="flex! items-center justify-center text-foreground"
        >
          <CompassIcon className="size-[18px]" />
        </motion.button>
      )}
    </AnimatePresence>,
    control.container,
  );
}
