import { useState } from 'react';
import { toast } from 'sonner';
import { CheckIcon, ChevronDownIcon, Loader2Icon, RefreshCwIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { useNow } from '@/hooks/now.hook';
import { formatAgo } from '@/lib/account';
import { apiErrorMessage } from '@/lib/api-error';
import type { GeminiModelInfo } from '@/lib/app-config';
import { TRIGGER_OPEN } from '@/lib/menu-styles';
import { SWAP_TRANSITION } from '@/lib/motion';
import { cn } from '@/lib/utils';

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
  /** The picked model is being saved: the trigger shows a spinner (the value already shows the pick) */
  saving?: boolean;
  /** The feature's name, for the trigger's aria-label */
  label: string;
  /** Extra trigger classes, e.g. `w-auto flex-1` to fill a line on phones */
  className?: string;
}

/** A1 dropdown: the current model's name; the menu has search, groups and a "standaard" tag. */
export default function ModelPicker({ value, defaultId, models, fetchedAt, listError, onRefresh, onChange, disabled, saving, label, className }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Ticks only while the menu is open, for the "Lijst van Google · 2 min geleden" footer
  const now = useNow(open, 30_000);
  const current = models?.find((model) => model.id === value);
  const name = (current?.displayName ?? value).replace(/^Gemini /, '');
  // The list is still on its way: "Modellen laden…" instead of "Geen model gevonden."
  const loading = !models && !listError;

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
          aria-busy={saving || undefined}
          className={cn(
            'inline-flex h-[34px] w-[190px] shrink-0 items-center justify-between gap-2 rounded-xl bg-beheer-row-high pr-2.5 pl-3 text-[12.5px] font-semibold outline-none transition-colors hover:bg-beheer-row-high/70 focus-visible:ring-[3px] focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
            TRIGGER_OPEN,
            className,
          )}
        >
          <span className="truncate">{name}</span>
          <AnimatePresence mode="popLayout" initial={false}>
            {saving ? (
              <motion.span key="saving" className="inline-flex" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={SWAP_TRANSITION}>
                <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
              </motion.span>
            ) : (
              <motion.span key="chevron" className="inline-flex" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={SWAP_TRANSITION}>
                <ChevronDownIcon data-chevron className="size-4 text-muted-foreground" />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </PopoverTrigger>
      <PopoverContent aria-label="Model kiezen" align="end" className="w-80 p-3">
        <Command label="Model zoeken">
          <CommandInput placeholder="Zoek model…" />
          <CommandList className="max-h-72">
            {loading ? (
              <div role="status" aria-label="Modellen laden…" className="flex flex-col gap-1 p-1">
                <span className="px-1 pb-1 text-xs desk:text-[11.5px] text-muted-foreground">Modellen laden…</span>
                {Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="flex items-center gap-2 px-1 py-1.5">
                    <Skeleton className="size-4 rounded" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-2.5 w-44 max-w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <CommandEmpty>{listError ?? 'Geen model gevonden.'}</CommandEmpty>
            )}
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
                        if (model.id !== value && !saving) onChange(model.id);
                        setOpen(false);
                      }}
                    >
                      <CheckIcon className={cn('size-4 text-primary-text transition-opacity', model.id !== value && 'opacity-0')} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">{model.displayName}</span>
                        <span className="block truncate font-mono text-xs desk:text-[11px] text-muted-foreground">{model.id}</span>
                      </span>
                      {model.id === defaultId && <span className="rounded-md bg-primary-container px-1.5 text-xs desk:text-[10px] font-extrabold text-on-primary-container">standaard</span>}
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
          className="mt-2 flex w-full items-center gap-1.5 rounded-[14px] bg-beheer-row px-3 py-2 text-left text-xs desk:text-[11.5px] text-muted-foreground transition-colors hover:bg-beheer-row-high hover:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          <RefreshCwIcon className={cn('size-3.5 shrink-0', refreshing && 'animate-spin')} />
          {listError ? 'Lijst niet beschikbaar · opnieuw proberen' : `Lijst van Google${fetchedAt ? ` · ${formatAgo(fetchedAt, now)}` : ''}`}
        </button>
      </PopoverContent>
    </Popover>
  );
}
