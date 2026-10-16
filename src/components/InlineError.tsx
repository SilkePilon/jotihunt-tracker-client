import type { ComponentProps } from 'react';

/** A short inline error line under a form or action (small, medium weight, destructive colour). */
export default function InlineError(props: Omit<ComponentProps<'p'>, 'className'>) {
  return <p {...props} className="text-xs font-medium text-destructive" />;
}
