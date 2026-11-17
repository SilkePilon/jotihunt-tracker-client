import { Skeleton } from '@/components/ui/skeleton';

/**
 * A link card's first load (Life360, Jotiboard, Telegram): the size of its "not linked yet" view — two lines of text
 * and the 44px "Koppel …" button — so the card doesn't grow or jump once the status is in.
 */
export default function IntegrationCardSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-2.5" role="status" aria-label={label}>
      <div className="flex flex-col gap-1.5 py-px">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <Skeleton className="h-11 w-full rounded-lg" />
    </div>
  );
}
