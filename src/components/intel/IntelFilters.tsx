import type { Ref } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { IntelFilter, IntelType } from '@/types/Intel';

const TYPE_CHIPS: { type: IntelType | 'all'; label: string; dot?: string }[] = [
  { type: 'all', label: 'Alles' },
  { type: 'hint', label: 'Hints', dot: 'bg-primary' },
  { type: 'assignment', label: 'Opdrachten', dot: 'bg-blue-500' },
  { type: 'news', label: 'Nieuws', dot: 'bg-violet-500' },
];

const CHIP =
  'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';
const CHIP_ON = 'border-foreground bg-foreground text-background';
const CHIP_OFF = 'text-muted-foreground hover:text-foreground';

interface IntelFiltersProps {
  filter: IntelFilter;
  counts: Record<IntelType | 'all', number>;
  onChange: (filter: IntelFilter) => void;
  /** The search field, so the page can put the keyboard focus in it */
  searchRef?: Ref<HTMLInputElement>;
}

/** The filters above the list: a chip per type with its count, the search field and the "only open" toggle */
export default function IntelFilters({ filter, counts, onChange, searchRef }: IntelFiltersProps) {
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {TYPE_CHIPS.map(({ type, label, dot }) => (
          <button key={type} type="button" aria-pressed={filter.type === type} className={cn(CHIP, filter.type === type ? CHIP_ON : CHIP_OFF)} onClick={() => onChange({ ...filter, type })}>
            {dot && <span className={cn('size-2 rounded-full', dot)} aria-hidden />}
            {label}
            <span className="font-normal tabular-nums opacity-70">{counts[type]}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          ref={searchRef}
          type="search"
          aria-label="Zoeken"
          placeholder="Zoeken in titel en tekst…"
          className="h-8 min-w-0 flex-1 text-sm"
          value={filter.query}
          onChange={(event) => onChange({ ...filter, query: event.target.value })}
        />
        <button
          type="button"
          aria-pressed={filter.openOnly}
          title="Alleen wat nog aandacht vraagt"
          className={cn(CHIP, 'py-1', filter.openOnly ? CHIP_ON : CHIP_OFF)}
          onClick={() => onChange({ ...filter, openOnly: !filter.openOnly })}
        >
          Open
        </button>
      </div>
    </>
  );
}
