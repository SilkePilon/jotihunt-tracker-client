import { createContext, useContext, useLayoutEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpIcon, SquareIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TOGGLE_SPRING } from '@/lib/intel-window';
import { POP_SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface PromptInputContextValue {
  value: string;
  setValue: (value: string) => void;
  maxHeight: number;
  onSubmit?: () => void;
  disabled: boolean;
}

const PromptInputContext = createContext<PromptInputContextValue | null>(null);

function usePromptInput() {
  const context = useContext(PromptInputContext);
  if (!context) throw new Error('PromptInput parts must be inside <PromptInput>');
  return context;
}

interface PromptInputProps extends Omit<ComponentProps<'div'>, 'onSubmit'> {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit?: () => void;
  /** The textarea grows with its text up to this height, then scrolls */
  maxHeight?: number;
  disabled?: boolean;
}

/** T1 prompt box: tonal container (no border), orange focus ring; textarea on top, the actions row below */
export function PromptInput({ value, onValueChange, onSubmit, maxHeight = 160, disabled = false, className, children, ...props }: PromptInputProps) {
  return (
    <PromptInputContext.Provider value={{ value, setValue: onValueChange, maxHeight, onSubmit, disabled }}>
      <div className={cn('rounded-[20px] bg-beheer-row-high p-1.5 transition-shadow duration-200 focus-within:ring-[3px] focus-within:ring-ring/50', className)} {...props}>
        {children}
      </div>
    </PromptInputContext.Provider>
  );
}

/** Autosizing textarea: Enter sends, Shift+Enter is a new line */
export function PromptInputTextarea({ className, onKeyDown, ...props }: Omit<ComponentProps<'textarea'>, 'value' | 'onChange'>) {
  const { value, setValue, maxHeight, onSubmit, disabled } = usePromptInput();
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
  }, [value, maxHeight]);
  return (
    <textarea
      {...props}
      ref={ref}
      rows={1}
      value={value}
      disabled={disabled}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault();
          onSubmit?.();
        }
      }}
      className={cn(
        'block min-h-[38px] w-full resize-none overflow-y-auto bg-transparent px-2.5 py-2 text-[13.5px] leading-snug outline-none placeholder:text-muted-foreground disabled:opacity-60',
        className,
      )}
    />
  );
}

export function PromptInputActions({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex items-center gap-1', className)} {...props} />;
}

/** Tooltip around one action (a native or motion element, so the trigger gets its ref) */
export function PromptInputAction({ tooltip, children, side = 'top' }: { tooltip: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

const TOGGLE_ON: Record<'web' | 'think', string> = {
  web: 'bg-fox-cooldown-container text-fox-on-cooldown',
  think: 'bg-ai-think-container text-ai-on-think',
};

interface ModeToggleProps {
  on: boolean;
  onToggle: (on: boolean) => void;
  icon: ReactNode;
  label: string;
  tone: 'web' | 'think';
  tooltip: ReactNode;
}

/** A mode: icon only when off; on, it fills with its tonal pair, the icon turns once and the label slides out */
export function ModeToggle({ on, onToggle, icon, label, tone, tooltip }: ModeToggleProps) {
  return (
    <PromptInputAction tooltip={tooltip}>
      <button
        type="button"
        aria-pressed={on}
        aria-label={label}
        onClick={() => onToggle(!on)}
        className={cn(
          'flex h-8 items-center rounded-xl px-2 text-[12.5px] font-semibold outline-none transition-colors duration-200 focus-visible:ring-[3px] focus-visible:ring-ring/50',
          on ? TOGGLE_ON[tone] : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
        )}
      >
        <motion.span className="grid place-items-center [&_svg]:size-4" initial={false} animate={{ rotate: on ? 360 : 0, scale: on ? 1.08 : 1 }} transition={TOGGLE_SPRING}>
          {icon}
        </motion.span>
        <AnimatePresence initial={false}>
          {on && (
            <motion.span
              key="label"
              className="overflow-hidden whitespace-nowrap"
              initial={{ width: 0, opacity: 0, marginLeft: 0 }}
              animate={{ width: 'auto', opacity: 1, marginLeft: 6 }}
              exit={{ width: 0, opacity: 0, marginLeft: 0 }}
              transition={{ duration: 0.28, ease: [0.2, 0, 0, 1], opacity: { duration: 0.2 } }}
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </PromptInputAction>
  );
}

/** Idle: muted arrow (disabled); ready: orange arrow; busy: stop square. The icon swaps with a turn. */
export function SendButton({ state, onSend, onStop }: { state: 'idle' | 'ready' | 'busy'; onSend: () => void; onStop: () => void }) {
  const busy = state === 'busy';
  return (
    <PromptInputAction tooltip={busy ? 'Stoppen' : 'Versturen (Enter)'}>
      <motion.button
        type="button"
        aria-label={busy ? 'Stoppen' : 'Versturen'}
        disabled={state === 'idle'}
        onClick={busy ? onStop : onSend}
        animate={{ scale: state === 'ready' ? 1.04 : 1 }}
        transition={POP_SPRING}
        className={cn(
          'ml-auto grid size-[34px] place-items-center rounded-xl outline-none transition-colors duration-200 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none',
          state === 'idle' ? 'text-muted-foreground' : 'bg-primary-container text-on-primary-container hover:bg-[color-mix(in_oklab,var(--on-primary-container)_10%,var(--primary-container))]',
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={busy ? 'stop' : 'send'}
            className="grid place-items-center"
            initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
            transition={{ duration: 0.18 }}
          >
            {busy ? <SquareIcon className="size-3.5 fill-current" /> : <ArrowUpIcon className="size-4" />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </PromptInputAction>
  );
}
