import { AnimatePresence, motion, useTransform } from 'motion/react';
import { cookiePath, MARKER_COOKIE_DEPTH } from '@/lib/cookie-shape';
import { GLYPHS } from '@/components/layers/marker-glyphs';
import { useMarkerPalette } from '@/components/layers/marker-icons';
import HuntStart from '@/components/hunts/HuntStart';
import { FoxIcon } from '@/components/MaterialGlyph';
import useSidebarStore from '@/stores/sidebar.store';
import { tourTarget } from '@/components/tour/targets';
import { POP } from '@/lib/motion';
import { sheetVisibleHeight } from './sheet-motion';

const SIZE = 60;
const RIM = 2.5;
const PATH = cookiePath(SIZE - RIM * 2, MARKER_COOKIE_DEPTH);

/**
 * Phones: "Hunt registreren" as the map's hunt marker (teal cookie, rim, marker shadow, camera glyph): what you tap
 * is what appears on the map. With "Foto bij hunt" off it's "Hunt melden" with the fox (no camera). Rides 12px above
 * the sheet; hidden while the sheet is full.
 */
export default function HuntMarkerButton() {
  const palette = useMarkerPalette();
  const snap = useSidebarStore((s) => s.sheetSnap);
  const bottom = useTransform(sheetVisibleHeight, (h) => h + 12);
  return (
    <HuntStart capture>
      {(open, photoMode, ready) => (
        <motion.div className="fixed right-3 z-30" style={{ bottom }}>
          <AnimatePresence initial={false}>
            {snap !== 'full' && (
              <motion.button
                {...POP}
                // Dimmed and inert until "Foto bij hunt" is known
                animate={{ ...POP.animate, opacity: ready ? 1 : 0.5 }}
                disabled={!ready}
                {...tourTarget('huntCapture.button')}
                type="button"
                aria-label={photoMode ? 'Hunt registreren' : 'Hunt melden'}
                onClick={open}
                whileTap={{ scale: 0.88 }}
                className="relative grid place-items-center"
                style={{ width: SIZE, height: SIZE, color: palette.onTertiaryContainer, filter: 'drop-shadow(0 1px 4.5px rgb(0 0 0/.3)) drop-shadow(0 6px 14px rgb(0 0 0/.22))' }}
              >
                <svg className="absolute inset-0 overflow-visible" width={SIZE} height={SIZE} viewBox={`${-RIM} ${-RIM} ${SIZE} ${SIZE}`} aria-hidden>
                  <path d={PATH} fill={palette.tertiaryContainer} stroke={palette.surfaceContainerLowest} strokeWidth={RIM * 2} paintOrder="stroke" />
                </svg>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span key={photoMode ? 'camera' : 'fox'} className="relative grid place-items-center" {...POP}>
                    {photoMode ? (
                      <svg width={26} height={26} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d={GLYPHS.photo_camera} />
                      </svg>
                    ) : (
                      <FoxIcon size={27} />
                    )}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </HuntStart>
  );
}
