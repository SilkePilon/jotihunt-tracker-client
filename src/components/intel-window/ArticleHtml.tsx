import { memo, useMemo, useState } from 'react';
import ImageLightbox from '@/components/ImageLightbox';
import { sanitizeHintHtml } from '@/lib/hints';

/** Sanitised article HTML; an image opens in the zoomable lightbox */
function ArticleHtml({ html }: { html: string }) {
  const sanitized = useMemo(() => sanitizeHintHtml(html), [html]);
  const [zoom, setZoom] = useState<string | null>(null);
  return (
    <>
      <div
        className="px-1 text-sm leading-relaxed break-words [&_a]:text-primary [&_a]:underline [&_img]:my-2 [&_img]:h-auto [&_img]:max-w-full [&_img]:cursor-zoom-in [&_img]:rounded-xl [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&>:first-child]:mt-0 [&>:last-child]:mb-0"
        onClick={(event) => {
          if (event.target instanceof HTMLImageElement) {
            event.preventDefault();
            setZoom(event.target.src);
          }
        }}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
      <ImageLightbox src={zoom ?? ''} alt="" open={zoom !== null} onOpenChange={(open) => !open && setZoom(null)} />
    </>
  );
}

export default memo(ArticleHtml);
