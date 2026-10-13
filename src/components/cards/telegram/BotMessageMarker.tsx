import { useMemo } from 'react';
import MaterialGlyph from '@/components/MaterialGlyph';
import { botMarkerColors, botMessageStyle } from '@/lib/bot-messages';
import { BADGE_COOKIE_DEPTH, cookiePath } from '@/lib/cookie-shape';
import type { MarkerPalette } from '@/lib/marker-style';

/** Circles and the tegenhunt cookie share one 32 px box, so the timeline line keeps its 6 px gap to every marker. */
const SIZE = 32;
const RIM = 2;

/** Timeline marker, built like the map markers but flat: container colour, on-colour glyph and a 2 px rim. */
export default function BotMessageMarker({ kind, palette }: { kind: string; palette: MarkerPalette }) {
  const { shape, fill, glyph, rim } = botMarkerColors(kind, palette);
  const name = botMessageStyle(kind).glyph;
  const outer = useMemo(() => cookiePath(SIZE, BADGE_COOKIE_DEPTH), []);
  const inner = useMemo(() => cookiePath(SIZE - RIM * 2, BADGE_COOKIE_DEPTH), []);

  if (shape === 'cookie') {
    return (
      <span className="relative grid shrink-0 place-items-center" style={{ width: SIZE, height: SIZE }} data-bot-marker={kind}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden className="absolute inset-0">
          <path d={outer} fill={rim} />
          <path d={inner} fill={fill} transform={`translate(${RIM} ${RIM})`} />
        </svg>
        <MaterialGlyph name={name} size={18} color={glyph} className="relative" />
      </span>
    );
  }

  return (
    <span
      className="grid shrink-0 place-items-center rounded-full border-2"
      style={{ width: SIZE, height: SIZE, background: fill, borderColor: rim }}
      data-bot-marker={kind}
    >
      <MaterialGlyph name={name} size={18} color={glyph} />
    </span>
  );
}
