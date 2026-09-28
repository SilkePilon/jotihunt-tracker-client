import { ReactNode, useState } from 'react';
import { EyeIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConcealedProps {
  /** Blur the content (the hunt still has to be submitted) */
  concealed: boolean;
  /** `text` for codes, `image` for photos (stronger blur and a "tik om te tonen" hint) */
  kind?: 'text' | 'image';
  className?: string;
  children: ReactNode;
}

/**
 * Hides a hunt code or photo behind a blur while the hunt still has to be submitted, so it isn't readable over
 * someone's shoulder. Hovering shows it; on touch screens the first tap reveals it (and doesn't trigger the
 * surrounding row/button).
 */
export default function Concealed({ concealed, kind = 'text', className, children }: ConcealedProps) {
  const [revealed, setRevealed] = useState(false);
  if (!concealed || revealed) return <>{children}</>;

  return (
    <span
      className={cn('group/conceal relative inline-flex max-w-full cursor-pointer', kind === 'image' && 'flex w-full', className)}
      title="Verborgen tot de hunt is ingestuurd — wijs aan of tik om te tonen"
      onClickCapture={(event) => {
        event.stopPropagation();
        event.preventDefault();
        setRevealed(true);
      }}
    >
      <span
        className={cn(
          'min-w-0 select-none transition-[filter] duration-200 group-hover/conceal:blur-none',
          kind === 'image' ? 'w-full blur-2xl' : 'blur-[5px]',
        )}
      >
        {children}
      </span>
      {kind === 'image' && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center group-hover/conceal:hidden">
          <span className="flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-sm font-medium shadow">
            <EyeIcon className="size-4" />
            Tik om te tonen
          </span>
        </span>
      )}
      <span className="sr-only">Verborgen tot de hunt is ingestuurd</span>
    </span>
  );
}
