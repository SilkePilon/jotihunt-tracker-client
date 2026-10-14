import type { ComponentProps } from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

/**
 * Material 3 switch: a 44×26 track with an outline when off and orange when on; the thumb grows from 12 to 20 px as it
 * slides over. CSS transitions (off for reduced motion).
 */
export default function BeheerSwitch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'inline-flex h-[26px] w-11 shrink-0 items-center rounded-full outline-none transition-[background-color,box-shadow] duration-200 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
        'data-[state=checked]:bg-primary data-[state=unchecked]:bg-beheer-row data-[state=unchecked]:shadow-[inset_0_0_0_2px_color-mix(in_oklab,var(--muted-foreground)_70%,transparent)]',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-3 translate-x-[7px] rounded-full bg-muted-foreground transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none data-[state=checked]:size-5 data-[state=checked]:translate-x-[21px] data-[state=checked]:bg-white" />
    </SwitchPrimitive.Root>
  );
}
