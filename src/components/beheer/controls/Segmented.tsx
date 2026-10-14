import { useId, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import { POP_SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface SegmentedProps<T extends string> {
  value: T | undefined;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  /** Accessible name of the group, e.g. "Geldig" */
  label: string;
  disabled?: boolean;
  className?: string;
}

/** Pill group on a soft background; the selected segment is card-coloured with a shadow and slides to a new choice. Wraps on narrow screens. */
export default function Segmented<T extends string>({ value, options, onChange, label, disabled, className }: SegmentedProps<T>) {
  const id = useId();
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value ?? ''}
      // Radix sends '' when the selected segment is tapped again: keep one selected
      onValueChange={(next) => next && onChange(next as T)}
      aria-label={label}
      disabled={disabled}
      className={cn('inline-flex max-w-full flex-wrap gap-0.5 rounded-lg bg-beheer-row p-[3px]', className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <ToggleGroupPrimitive.Item
            key={option.value}
            value={option.value}
            className={cn(
              'relative inline-flex h-[30px] items-center rounded-[9px] px-3 text-[12.5px] font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0',
              selected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {selected && <motion.span layoutId={`${id}-selected`} aria-hidden className="absolute inset-0 rounded-[9px] bg-card shadow-[0_1px_3px_rgb(0_0_0/0.25)]" transition={POP_SPRING} />}
            <span className="relative inline-flex items-center gap-1.5">
              {option.icon}
              {option.label}
            </span>
          </ToggleGroupPrimitive.Item>
        );
      })}
    </ToggleGroupPrimitive.Root>
  );
}
