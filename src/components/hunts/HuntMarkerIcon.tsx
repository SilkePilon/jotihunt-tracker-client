import { useMemo } from 'react';
import { GlobeIcon } from 'lucide-react';
import { useMarkerPalette } from '@/components/layers/marker-icons';
import MarkerGlyph from '@/components/map/popup/MarkerGlyph';
import { cookiePath, MARKER_COOKIE_DEPTH } from '@/lib/cookie-shape';
import { areaKey, areaLetter } from '@/lib/marker-style';
import { getColorFromArea } from '@/lib/utils';

const SIZE = 48;

/**
 * The map's hunt marker as a list icon: camera on the tertiary-container cookie with the area letter in a badge
 * (bottom right). Website-only hunts (no photo): a globe on the neutral cookie.
 */
export default function HuntMarkerIcon({ area, website = false }: { area: string; website?: boolean }) {
  const palette = useMarkerPalette();
  const path = useMemo(() => cookiePath(SIZE, MARKER_COOKIE_DEPTH), []);
  const key = areaKey(area);
  const letter = key ? areaLetter(key) : '';
  const fill = website ? palette.surfaceContainerHighest : palette.tertiaryContainer;
  const on = website ? palette.onSurfaceVariant : palette.onTertiaryContainer;

  return (
    <span aria-hidden className="relative grid size-12 shrink-0 place-items-center">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 overflow-visible drop-shadow-[0_1px_2px_rgb(0_0_0/0.3)]">
        <path d={path} fill={fill} />
      </svg>
      <span className="relative grid place-items-center [&_svg]:size-6" style={{ color: on }}>
        {website ? <GlobeIcon /> : <MarkerGlyph name="photo_camera" />}
      </span>
      {letter && (
        <span
          className="absolute -right-[3px] -bottom-[3px] grid size-[18px] place-items-center rounded-full text-[10.5px] font-extrabold"
          style={{ background: palette.surfaceContainerLowest, color: getColorFromArea(area) }}
        >
          {letter}
        </span>
      )}
    </span>
  );
}
