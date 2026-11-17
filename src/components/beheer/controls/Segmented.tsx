import { useId, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import { POP_SPRING } from '@/lib/motion';
import { COARSE_HIT_AREA } from '@/lib/hit-area';
import { cn } from '@/lib/utils';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Background of the selected segment instead of the card colour (night area kinds: red / green tonal) */
  selectedClassName?: string;
  /** Text colour of the selected segment instead of the foreground */
  selectedTextClassName?: string;
}

interface SegmentedProps<T extends string> {
  value: T | undefined;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  /** Accessible name of the group, e.g. "Geldig" */
  label: string;
  disabled?: boolean;
  /** Saving a choice: looks disabled and ignores taps, but keeps the focus (aria-disabled instead of disabled) */
  busy?: boolean;
  className?: string;
}

/**
 * The selected segment: card-coloured with a hairline and a soft drop shadow. The card alone is ~1.1:1 against the
 * beheer-row track; the hairline (input mixed 15% towards the foreground) is >= 3.9:1 against it in both themes.
 */
export const SEGMENT_THUMB = 'bg-card shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,var(--input)_85%,var(--foreground)),0_1px_3px_rgb(0_0_0/0.25)]';

/** Pill group on a soft background; the selected segment is card-coloured with a hairline and slides to a new choice. Wraps on narrow screens. */
export default function Segmented<T extends string>({ value, options, onChange, label, disabled, busy, className }: SegmentedProps<T>) {
  const id = useId();
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value ?? ''}
      // Radix sends '' when the selected segment is tapped again: keep one selected
      onValueChange={(next) => next && !busy && onChange(next as T)}
      aria-label={label}
      disabled={disabled}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      // isolate: the segments' 44px touch areas (COARSE_HIT_AREA) stay above the group's background
      className={cn('group/segmented isolate inline-flex max-w-full flex-wrap gap-0.5 rounded-lg bg-beheer-row p-[3px]', className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <ToggleGroupPrimitive.Item
            key={option.value}
            value={option.value}
            className={cn(
              COARSE_HIT_AREA,
              'inline-flex h-[30px] items-center rounded-(--radius-inner) px-3 text-caption font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-50 group-aria-disabled/segmented:pointer-events-none group-aria-disabled/segmented:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0',
              selected ? (option.selectedTextClassName ?? 'text-foreground') : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {selected && <motion.span layoutId={`${id}-selected`} aria-hidden className={cn('absolute inset-0 rounded-(--radius-inner) transition-colors', option.selectedClassName ?? SEGMENT_THUMB)} transition={POP_SPRING} />}
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
