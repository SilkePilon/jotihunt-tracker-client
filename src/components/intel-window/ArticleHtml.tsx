import { memo, useEffect, useMemo, useRef, useState } from 'react';
import ImageLightbox from '@/components/ImageLightbox';
import { sanitizeHintHtml } from '@/lib/hints';
import { cn } from '@/lib/utils';

/** Sanitised article HTML; an image opens in the zoomable lightbox. `className` overrides the text look (merged). */
function ArticleHtml({ html, className }: { html: string; className?: string }) {
  const sanitized = useMemo(() => sanitizeHintHtml(html), [html]);
  // The clicked image (src + alt); the lightbox labels the photo with its alt
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  // Keyboard and screen readers: every image (outside a link, which has its own action) is a "Foto vergroten" button
  useEffect(() => {
    for (const img of ref.current?.querySelectorAll('img') ?? []) {
      if (img.closest('a')) continue;
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', img.alt ? `Foto vergroten: ${img.alt}` : 'Foto vergroten');
    }
  }, [sanitized]);
  return (
    <>
      <div
        ref={ref}
        className={cn(
          // Headings follow ChatMarkdown: a step or two above the body text, bold, tight leading, a little more room above than below
          'px-1 text-sm leading-relaxed break-words [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:leading-snug [&_h1]:font-bold [&_h2]:mt-3.5 [&_h2]:mb-1.5 [&_h2]:text-title [&_h2]:leading-snug [&_h2]:font-bold [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:leading-snug [&_h3]:font-semibold [&_a]:text-primary-text [&_a]:underline [&_img]:my-2 [&_img]:h-auto [&_img]:max-w-full [&_img]:cursor-zoom-in [&_img]:rounded-xl [&_img]:outline-none [&_img:focus-visible]:ring-[3px] [&_img:focus-visible]:ring-ring [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&>:first-child]:mt-0 [&>:last-child]:mb-0',
          className,
        )}
        onClick={(event) => {
          if (event.target instanceof HTMLImageElement) {
            event.preventDefault();
            setZoom({ src: event.target.src, alt: event.target.alt });
          }
        }}
        onKeyDown={(event) => {
          if (event.target instanceof HTMLImageElement && event.target.getAttribute('role') === 'button' && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            setZoom({ src: event.target.src, alt: event.target.alt });
          }
        }}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
      <ImageLightbox src={zoom?.src ?? ''} alt={zoom?.alt ?? ''} open={zoom !== null} onOpenChange={(open) => !open && setZoom(null)} />
    </>
  );
}

export default memo(ArticleHtml);
