import { useRef, useState } from 'react';
import { ClockIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { SWAP } from '@/lib/motion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Segmented from '@/components/beheer/controls/Segmented';
import { cn } from '@/lib/utils';
import { dayKey, defaultDay, shortLabel, type HintDay } from './hint-times';
import { PickerTrigger, pickerTileClass } from './picker-parts';

interface TimePickerProps {
  id: string;
  value: string;
  onChange: (iso: string) => void;
  days: HintDay[];
  /** Controlled, so picking an area can open it */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  invalid?: boolean;
  /** Runs once the popover has closed after a pick (focuses X) */
  afterPick?: () => void;
}

/** Tijdstip picker: day switch and a grid of hours; hours that already have a hint for the area are crossed out. */
export default function TimePicker({ id, value, onChange, days, open, onOpenChange, disabled, invalid, afterPick }: TimePickerProps) {
  const [day, setDay] = useState<string>();
  const [wasOpen, setWasOpen] = useState(open);
  const picked = useRef(false);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDay(value ? dayKey(new Date(value)) : defaultDay(days));
  }

  const shown = days.find((d) => d.key === day) ?? days.find((d) => d.key === defaultDay(days));

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) picked.current = false;
        onOpenChange(next);
      }}
    >
      <PopoverTrigger asChild>
        <PickerTrigger
          id={id}
          disabled={disabled}
          invalid={invalid}
          placeholder="Tijd"
          label={value ? shortLabel(value) : undefined}
          aria-label={value ? `Tijd: ${shortLabel(value)}` : 'Tijd kiezen'}
          lead={<ClockIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />}
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        collisionPadding={8}
        className="w-[280px] p-2.5"
        // After a pick, focus goes on to the X digits instead of back to this trigger
        onCloseAutoFocus={(event) => {
          if (!picked.current) return;
          picked.current = false;
          event.preventDefault();
          afterPick?.();
        }}
      >
        {shown ? (
          <div className="flex flex-col gap-2">
            {days.length > 1 && (
              <Segmented
                label="Dag"
                value={shown.key}
                options={days.map((d) => ({ value: d.key, label: d.label }))}
                onChange={setDay}
                className="flex w-full flex-nowrap [&>*]:flex-1 [&>*]:justify-center"
              />
            )}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={shown.key} {...SWAP} className="grid grid-cols-4 gap-1">
                {shown.hours.map((hour) => (
                  <button
                    key={hour.value}
                    type="button"
                    disabled={hour.taken}
                    aria-pressed={hour.value === value}
                    title={hour.taken ? 'Al geregistreerd' : undefined}
                    aria-label={hour.taken ? `${hour.label}, al geregistreerd` : undefined}
                    className={cn(pickerTileClass(hour.value === value, hour.taken), 'h-[38px] tabular-nums')}
                    onClick={() => {
                      picked.current = true;
                      onChange(hour.value);
                      onOpenChange(false);
                    }}
                  >
                    {hour.label}
                  </button>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          <p className="px-2 py-3 text-center text-sm text-muted-foreground">(Nog) geen tijdstip te kiezen</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
