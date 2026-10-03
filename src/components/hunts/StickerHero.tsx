import { useLayoutEffect, useRef, useState } from 'react';
import { stickerCrop, type Size, type StickerBox } from '@/lib/sticker-crop';
import { cn } from '@/lib/utils';

/** Photo that fills its frame, zoomed onto the sticker when its box is known (else the whole photo, cover-fit). */
export default function StickerHero({ src, box, alt, className }: { src: string; box: StickerBox | null; alt: string; className?: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<Size | null>(null);
  const [image, setImage] = useState<Size | null>(null);

  useLayoutEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setFrame({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // A zero-size frame or image would make stickerCrop return NaN
  const crop = frame && image && frame.width > 0 && frame.height > 0 && image.width > 0 && image.height > 0 ? stickerCrop(box, image, frame) : null;

  return (
    <div ref={frameRef} className={cn('relative overflow-hidden bg-muted', className)}>
      <img
        src={src}
        alt={alt}
        // naturalWidth/Height already follow the EXIF orientation, like the rendered image
        onLoad={(event) => setImage({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
        className={cn('absolute max-w-none transition-[left,top,width,height] duration-300', !crop && 'invisible')}
        style={crop && image ? { left: crop.x, top: crop.y, width: image.width * crop.scale, height: image.height * crop.scale } : undefined}
      />
    </div>
  );
}
