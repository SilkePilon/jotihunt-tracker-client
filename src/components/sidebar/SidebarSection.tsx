import { ReactNode } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import useSidebarStore, { SidebarSectionId } from '@/stores/sidebar.store';
import { cn } from '@/lib/utils';
import { tourTarget } from '@/components/tour/targets';
import ErrorBoundary from '@/components/ErrorBoundary';

interface SidebarSectionProps {
  id: SidebarSectionId;
  title: string;
  /** Shown next to the title while the section is collapsed */
  summary?: ReactNode;
  /** Controlled open state; defaults to the persisted state in the sidebar store */
  open?: boolean;
  /** Called instead of toggling the store when the user opens/closes the section */
  onOpenChange?: (open: boolean) => void;
  /** Extra classes on the card, e.g. a tinted background */
  className?: string;
  children: ReactNode;
}

export default function SidebarSection({ id, title, summary, open: openProp, onOpenChange, className, children }: SidebarSectionProps) {
  const storedOpen = useSidebarStore((state) => state.openSections[id]);
  const toggleSection = useSidebarStore((state) => state.toggleSection);
  const open = openProp ?? storedOpen;

  return (
    <Collapsible {...tourTarget(`sidebar.${id}`)} open={open} onOpenChange={onOpenChange ?? (() => toggleSection(id))} className={cn('card rounded-xl bg-card px-3 pb-1 text-card-foreground', className)}>
      {/* A heading for screen-reader navigation (accordion pattern: the toggle inside the h2); no visual change */}
      {/* The header padding sits in the trigger (-mx-3 px-3 its sides, pt-2/pb-1, the ::after the card's last 4px or the
          content's 4px top): the whole 36px header row is the target, the card looks the same. Touch screens: at least
          44px tall */}
      <h2>
        <CollapsibleTrigger className="relative -mx-3 flex w-[calc(100%+1.5rem)] cursor-pointer items-center justify-between gap-2 rounded-xl px-3 pt-2 pb-1 text-left outline-none pointer-coarse:min-h-11 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset after:absolute after:inset-x-0 after:top-full after:h-1 after:content-['']">
          <span className="text-sm font-semibold">{title}</span>
          <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            {!open && summary && <span className="truncate">{summary}</span>}
            <ChevronDownIcon className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} />
          </span>
        </CollapsibleTrigger>
      </h2>
      {/* Vertical padding on the inner div so the animated height reaches 0 (with the trigger's pb-1 and the card's pb-1 the
          same 8px gaps as before); -mx-1 px-1 and py-1 keep focus rings unclipped */}
      <CollapsibleContent className="-mx-1 overflow-hidden px-1 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none">
        <div className="py-1">
          <ErrorBoundary variant="inline">{children}</ErrorBoundary>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
