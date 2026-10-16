import { FOX_OUTLINE, GLYPHS } from '@/components/layers/marker-glyphs';
import type { GlyphName } from '@/lib/marker-style';

/** A Material Symbols Rounded (filled) glyph from the map marker set, in currentColor unless `color` is given. */
export default function MaterialGlyph({ name, size, color, className }: { name: GlyphName; size: number; color?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className}>
      <path d={GLYPHS[name]} fill={color ?? 'currentColor'} />
    </svg>
  );
}

/** The happy-hour icon (Material `celebration`), usable where a lucide-style icon component is expected. */
export function CelebrationIcon({ className }: { className?: string }) {
  return <MaterialGlyph name="celebration" size={16} className={className} />;
}

/** The app's outline fox (stroked head, filled eyes and nose) in currentColor; usable where a lucide-style icon is expected. */
export function FoxIcon({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className}>
      <path d={FOX_OUTLINE.head} fill="none" stroke="currentColor" strokeWidth={FOX_OUTLINE.headStrokeWidth} strokeLinejoin="round" />
      <path d={FOX_OUTLINE.features} fill="currentColor" />
    </svg>
  );
}
