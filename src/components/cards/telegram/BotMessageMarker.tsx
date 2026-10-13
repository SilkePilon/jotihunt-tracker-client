import { useMemo } from 'react';
import MaterialGlyph from '@/components/MaterialGlyph';
import { botMarkerColors, botMessageStyle } from '@/lib/bot-messages';
import { BADGE_COOKIE_DEPTH, cookiePath } from '@/lib/cookie-shape';
import type { MarkerPalette } from '@/lib/marker-style';

/** Circles and the tegenhunt cookie share one 32 px box, so the timeline line keeps its 6 px gap to every marker. */
const SIZE = 32;

/** Timeline marker, coloured like the map markers but flat and without a rim: container colour and on-colour glyph. */
export default function BotMessageMarker({ kind, palette }: { kind: string; palette: MarkerPalette }) {
  const { shape, fill, glyph } = botMarkerColors(kind, palette);
  const name = botMessageStyle(kind).glyph;
  const path = useMemo(() => cookiePath(SIZE, BADGE_COOKIE_DEPTH), []);

  if (shape === 'cookie') {
    return (
      <span className="relative grid shrink-0 place-items-center" style={{ width: SIZE, height: SIZE }} data-bot-marker={kind}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden className="absolute inset-0">
          <path d={path} fill={fill} />
        </svg>
        <MaterialGlyph name={name} size={18} color={glyph} className="relative" />
      </span>
    );
  }

  return (
    <span
      className="grid shrink-0 place-items-center rounded-full"
      style={{ width: SIZE, height: SIZE, background: fill }}
      data-bot-marker={kind}
    >
      <MaterialGlyph name={name} size={18} color={glyph} />
    </span>
  );
}
