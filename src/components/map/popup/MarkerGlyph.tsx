import { GLYPHS } from '@/components/layers/marker-glyphs';
import type { GlyphName } from '@/lib/marker-style';

/** A Material Symbol from the marker glyph set, as inline SVG in the current text colour. */
export default function MarkerGlyph({ name, className }: { name: GlyphName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d={GLYPHS[name]} />
    </svg>
  );
}
