import { memo, useMemo } from 'react';
import { sanitizeHintHtml } from '@/lib/hints';
import { cn } from '@/lib/utils';

interface HintContentProps {
  html: string;
  onZoom: (src: string) => void;
  className?: string;
}

/**
 * Sanitised hint HTML; clicking an image opens it in the zoomable lightbox. Memoised so DOMPurify only runs when the
 * HTML changes, not on every re-render of the detail.
 */
function HintContent({ html, onZoom, className }: HintContentProps) {
  const sanitized = useMemo(() => sanitizeHintHtml(html), [html]);
  return (
    <div
      className={cn('rounded-lg border p-3 text-sm [&_img]:max-w-full [&_img]:cursor-zoom-in [&_img]:rounded', className)}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target instanceof HTMLImageElement) {
          event.preventDefault();
          onZoom(target.src);
        }
      }}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}

export default memo(HintContent);
