import { useMemo } from 'react';
import MaterialGlyph from '@/components/MaterialGlyph';
import { botMarkerColors, botMessageStyle } from '@/lib/bot-messages';
import { BADGE_COOKIE_DEPTH, cookiePath } from '@/lib/cookie-shape';
import type { MarkerPalette } from '@/lib/marker-style';

const SIZE = 32;
/** The tegenhunt cookie is a bit bigger and overhangs the 32 px column by 2 px on each side. */
const COOKIE_SIZE = 36;
const RIM = 2;

/** Timeline marker, built like the map markers but flat: container colour, on-colour glyph and a 2 px rim. */
export default function BotMessageMarker({ kind, palette }: { kind: string; palette: MarkerPalette }) {
  const { shape, fill, glyph, rim } = botMarkerColors(kind, palette);
  const name = botMessageStyle(kind).glyph;
  const outer = useMemo(() => cookiePath(COOKIE_SIZE, BADGE_COOKIE_DEPTH), []);
  const inner = useMemo(() => cookiePath(COOKIE_SIZE - RIM * 2, BADGE_COOKIE_DEPTH), []);

  if (shape === 'cookie') {
    return (
      <span className="relative -m-0.5 grid shrink-0 place-items-center" style={{ width: COOKIE_SIZE, height: COOKIE_SIZE }} data-bot-marker={kind}>
        <svg width={COOKIE_SIZE} height={COOKIE_SIZE} viewBox={`0 0 ${COOKIE_SIZE} ${COOKIE_SIZE}`} aria-hidden className="absolute inset-0">
          <path d={outer} fill={rim} />
          <path d={inner} fill={fill} transform={`translate(${RIM} ${RIM})`} />
        </svg>
        <MaterialGlyph name={name} size={20} color={glyph} className="relative" />
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
