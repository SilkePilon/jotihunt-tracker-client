import { GLYPHS } from '@/components/layers/marker-glyphs';
import type { GlyphName } from '@/lib/marker-style';

/** A Material Symbols Rounded (filled) glyph from the map marker set, in currentColor unless `color` is given. */
export default function MaterialGlyph({ name, size, color, className }: { name: GlyphName; size: number; color?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className}>
      <path d={GLYPHS[name]} fill={color ?? 'currentColor'} />
    </svg>
  );
}
