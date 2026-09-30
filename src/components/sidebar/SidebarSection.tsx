import { ReactNode } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import useSidebarStore, { SidebarSectionId } from '@/stores/sidebar.store';
import { cn } from '@/lib/utils';
import { tourTarget } from '@/components/tour/targets';

interface SidebarSectionProps {
  id: SidebarSectionId;
  title: string;
  /** Shown next to the title while the section is collapsed */
  summary?: ReactNode;
  /** Controlled open state; defaults to the persisted state in the sidebar store */
  open?: boolean;
  /** Called instead of toggling the store when the user opens/closes the section */
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export default function SidebarSection({ id, title, summary, open: openProp, onOpenChange, children }: SidebarSectionProps) {
  const storedOpen = useSidebarStore((state) => state.openSections[id]);
  const toggleSection = useSidebarStore((state) => state.toggleSection);
  const open = openProp ?? storedOpen;

  return (
    <Collapsible {...tourTarget(`sidebar.${id}`)} open={open} onOpenChange={onOpenChange ?? (() => toggleSection(id))} className="card rounded-xl bg-card px-3 py-2 text-card-foreground">
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-2 text-left">
        <span className="text-sm font-semibold">{title}</span>
        <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          {!open && summary && <span className="truncate">{summary}</span>}
          <ChevronDownIcon className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}
