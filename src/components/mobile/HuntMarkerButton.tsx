import { AnimatePresence, motion, useTransform } from 'motion/react';
import { cookiePath, MARKER_COOKIE_DEPTH } from '@/lib/cookie-shape';
import { GLYPHS } from '@/components/layers/marker-glyphs';
import { useMarkerPalette } from '@/components/layers/marker-icons';
import HuntPhotoInput from '@/components/hunts/HuntPhotoInput';
import useSidebarStore from '@/stores/sidebar.store';
import { tourTarget } from '@/components/tour/targets';
import { POP } from '@/lib/motion';
import { sheetVisibleHeight } from './sheet-motion';

const SIZE = 60;
const RIM = 2.5;
const PATH = cookiePath(SIZE - RIM * 2, MARKER_COOKIE_DEPTH);

/**
 * Phones: "Hunt registreren" as the map's hunt marker (teal cookie, rim, marker shadow, camera glyph): what you tap
 * is what appears on the map. Rides 12px above the sheet; hidden while the sheet is full.
 */
export default function HuntMarkerButton() {
  const palette = useMarkerPalette();
  const snap = useSidebarStore((s) => s.sheetSnap);
  const bottom = useTransform(sheetVisibleHeight, (h) => h + 12);
  return (
    <HuntPhotoInput capture>
      {(open) => (
        <motion.div className="fixed right-3 z-30" style={{ bottom }}>
          <AnimatePresence initial={false}>
            {snap !== 'full' && (
              <motion.button
                {...POP}
                {...tourTarget('huntCapture.button')}
                type="button"
                aria-label="Hunt registreren"
                onClick={open}
                whileTap={{ scale: 0.88 }}
                className="relative grid place-items-center"
                style={{ width: SIZE, height: SIZE, color: palette.onTertiaryContainer, filter: 'drop-shadow(0 1px 4.5px rgb(0 0 0/.3)) drop-shadow(0 6px 14px rgb(0 0 0/.22))' }}
              >
                <svg className="absolute inset-0 overflow-visible" width={SIZE} height={SIZE} viewBox={`${-RIM} ${-RIM} ${SIZE} ${SIZE}`} aria-hidden>
                  <path d={PATH} fill={palette.tertiaryContainer} stroke={palette.surfaceContainerLowest} strokeWidth={RIM * 2} paintOrder="stroke" />
                </svg>
                <svg className="relative" width={26} height={26} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d={GLYPHS.photo_camera} />
                </svg>
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </HuntPhotoInput>
  );
}
