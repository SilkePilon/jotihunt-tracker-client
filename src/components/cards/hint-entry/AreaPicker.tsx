import { useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MENU_CARD } from '@/components/settings/menu-parts';
import { areaOptions, cn, getColorFromArea } from '@/lib/utils';
import { PickerTrigger, pickerTileClass } from './picker-parts';

interface AreaPickerProps {
  id: string;
  value: string;
  onChange: (area: string) => void;
  invalid?: boolean;
  /** Runs once the popover has closed after a pick (opens the time picker) */
  afterPick?: () => void;
}

/** Deelgebied picker: trigger with the area's map colour, popover with a 3×3 grid of area tiles. */
export default function AreaPicker({ id, value, onChange, invalid, afterPick }: AreaPickerProps) {
  const [open, setOpen] = useState(false);
  const picked = useRef(false);
  const current = areaOptions.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <PickerTrigger
          id={id}
          invalid={invalid}
          placeholder="Gebied"
          label={current?.label}
          aria-label={current ? `Gebied: ${current.label}` : 'Gebied kiezen'}
          lead={<span aria-hidden className="size-2.5 shrink-0 rounded-full transition-colors duration-200" style={{ background: current ? getColorFromArea(current.value) : 'var(--border)' }} />}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={8}
        className={cn(MENU_CARD, 'w-[300px] p-2.5')}
        // After a pick, focus goes on to the time picker instead of back to this trigger
        onCloseAutoFocus={(event) => {
          if (!picked.current) return;
          picked.current = false;
          event.preventDefault();
          afterPick?.();
        }}
      >
        <div className="grid grid-cols-3 gap-1">
          {areaOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={option.value === value}
              className={cn(pickerTileClass(option.value === value), 'h-11')}
              onClick={() => {
                picked.current = true;
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: getColorFromArea(option.value) }} />
              {option.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
