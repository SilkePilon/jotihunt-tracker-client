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
    <Collapsible {...tourTarget(`sidebar.${id}`)} open={open} onOpenChange={onOpenChange ?? (() => toggleSection(id))} className={cn('card rounded-xl bg-card px-3 py-2 text-card-foreground', className)}>
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-2 text-left">
        <span className="text-sm font-semibold">{title}</span>
        <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          {!open && summary && <span className="truncate">{summary}</span>}
          <ChevronDownIcon className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} />
        </span>
      </CollapsibleTrigger>
      {/* Vertical padding on the inner div so the animated height reaches 0; -mx-1 px-1 keeps focus rings unclipped */}
      <CollapsibleContent className="-mx-1 overflow-hidden px-1 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none">
        <div className="pt-2">
          <ErrorBoundary variant="inline">{children}</ErrorBoundary>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
