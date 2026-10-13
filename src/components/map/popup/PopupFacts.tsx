import type { ReactNode } from 'react';

/** Lines of small facts under the header. */
export function PopupFacts({ children }: { children: ReactNode }) {
  return <div className="mt-2 flex flex-col gap-0.5 text-(--map-on-surface-variant)">{children}</div>;
}

/** One fact line: 13px muted icon(s) + text. */
export function PopupFact({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 items-center gap-1.5 [&_svg]:size-[13px] [&_svg]:shrink-0 [&_svg]:text-(--map-muted)">{children}</div>;
}

/** Muted separator between two facts on one line. */
export function FactDot() {
  return <span className="mx-0.5 text-(--map-muted)">·</span>;
}
