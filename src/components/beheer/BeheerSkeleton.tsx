import { Skeleton } from '@/components/ui/skeleton';

/** Stands in for a pane's cards while their data loads. */
export function BeheerSkeleton({ groups = 1 }: { groups?: number }) {
  return (
    <div className="flex flex-col gap-3.5">
      {Array.from({ length: groups }, (_, index) => (
        <div key={index} className="flex flex-col gap-3 rounded-3xl bg-card p-4">
          <Skeleton className="mx-1 h-5 w-28 bg-beheer-row-high" />
          <Skeleton className="h-28 w-full rounded-2xl bg-beheer-row" />
        </div>
      ))}
    </div>
  );
}

/** The whole Beheer window while its chunk loads: the nav column and a pane (desktop), or the section list (phones). */
export function BeheerWindowSkeleton({ mobile }: { mobile: boolean }) {
  if (mobile) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-0.5" role="status" aria-label="Beheer laden">
        <Skeleton className="mx-3 mt-1 mb-3 h-6 w-24" />
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-xl bg-beheer-row" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr]" role="status" aria-label="Beheer laden">
      <div className="flex flex-col gap-1.5 px-3 py-[18px]">
        <Skeleton className="mx-3 mb-3 h-5 w-20" />
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-full rounded-xl bg-beheer-row" />
        ))}
      </div>
      <div className="flex flex-col gap-4 px-7 py-6">
        <Skeleton className="h-6 w-40" />
        <BeheerSkeleton groups={2} />
      </div>
    </div>
  );
}
