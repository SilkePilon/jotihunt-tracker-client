import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Group logo (from jotihunt.nl) in a white rounded square; the first letter of the group's name when there is no
 * logo or it fails to load.
 */
export default function TeamLogo({ name, logoUrl, className }: { name: string; logoUrl?: string; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showLogo = !!logoUrl && failedUrl !== logoUrl;

  return (
    <div className={cn('relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white shadow-sm', className)}>
      {showLogo ? (
        <img src={logoUrl} alt={`Logo van ${name}`} loading="lazy" className="size-full object-contain p-1" onError={() => setFailedUrl(logoUrl)} />
      ) : (
        <span aria-hidden="true" className="text-xl font-bold uppercase text-muted-foreground">
          {name.replace(/^scouting\s+/i, '').charAt(0)}
        </span>
      )}
    </div>
  );
}
