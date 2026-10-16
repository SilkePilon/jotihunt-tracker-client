import { useState } from 'react';
import { toast } from 'sonner';
import { CheckIcon, RefreshCwIcon } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNow } from '@/hooks/now.hook';
import { formatAgo } from '@/lib/account';
import { apiErrorMessage } from '@/lib/api-error';
import type { GeminiModelInfo } from '@/lib/app-config';
import { cn } from '@/lib/utils';
import { Chevron } from './BeheerLayout';

const GROUP_TITLE: Record<GeminiModelInfo['group'], string> = { alias: 'Aliassen', latest: 'Nieuwste versie', older: 'Ouder' };
const GROUPS = ['alias', 'latest', 'older'] as const;

interface ModelPickerProps {
  value: string;
  defaultId: string;
  models: GeminiModelInfo[] | undefined;
  fetchedAt?: string;
  listError?: string;
  onRefresh: () => Promise<void>;
  onChange: (id: string) => void;
  disabled?: boolean;
  /** The feature's name, for the trigger's aria-label */
  label: string;
  /** Extra trigger classes, e.g. `w-auto flex-1` to fill a line on phones */
  className?: string;
}

/** A1 dropdown: the current model's name; the menu has search, groups and a "standaard" tag. */
export default function ModelPicker({ value, defaultId, models, fetchedAt, listError, onRefresh, onChange, disabled, label, className }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Ticks only while the menu is open, for the "Lijst van Google · 2 min geleden" footer
  const now = useNow(open, 30_000);
  const current = models?.find((model) => model.id === value);
  const name = (current?.displayName ?? value).replace(/^Gemini /, '');

  async function refresh() {
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Lijst ophalen is mislukt.'));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={`Model voor ${label}`}
          className={cn(
            'inline-flex h-[34px] w-[190px] shrink-0 items-center justify-between gap-2 rounded-xl bg-beheer-row-high pr-2.5 pl-3 text-[12.5px] font-semibold outline-none transition-colors hover:bg-beheer-row-high/70 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
            className,
          )}
        >
          <span className="truncate">{name}</span>
          <Chevron open={open} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-2xl p-1.5">
        <Command>
          <CommandInput placeholder="Zoek model…" />
          <CommandList className="max-h-72">
            <CommandEmpty>{listError ?? 'Geen model gevonden.'}</CommandEmpty>
            {GROUPS.map((group) => {
              const items = models?.filter((model) => model.group === group) ?? [];
              if (!items.length) return null;
              return (
                <CommandGroup key={group} heading={GROUP_TITLE[group]}>
                  {items.map((model) => (
                    <CommandItem
                      key={model.id}
                      value={`${model.displayName} ${model.id}`}
                      onSelect={() => {
                        if (model.id !== value) onChange(model.id);
                        setOpen(false);
                      }}
                      className="gap-2.5 rounded-[10px]"
                    >
                      <CheckIcon className={cn('size-4 text-primary transition-opacity', model.id !== value && 'opacity-0')} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">{model.displayName}</span>
                        <span className="block truncate font-mono text-[11px] text-muted-foreground">{model.id}</span>
                      </span>
                      {model.id === defaultId && <span className="rounded-md bg-primary-container px-1.5 text-[10px] font-extrabold text-on-primary-container">standaard</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="mt-1 flex w-full items-center gap-1.5 border-t border-border px-2.5 pt-2 pb-1 text-left text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <RefreshCwIcon className={cn('size-3.5 shrink-0', refreshing && 'animate-spin')} />
          {listError ? 'Lijst niet beschikbaar · opnieuw proberen' : `Lijst van Google${fetchedAt ? ` · ${formatAgo(fetchedAt, now)}` : ''}`}
        </button>
      </PopoverContent>
    </Popover>
  );
}
