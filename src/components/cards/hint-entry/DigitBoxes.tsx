import { useContext, type Ref } from 'react';
import { OTPInput, OTPInputContext, REGEXP_ONLY_DIGITS } from 'input-otp';
import { cn } from '@/lib/utils';

interface DigitBoxesProps {
  id: string;
  /** "X" or "Y" */
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  /** All 6 digits entered: move focus on */
  onComplete: () => void;
  /** Outside the Netherlands or rejected: filled boxes turn red */
  bad: boolean;
  ref?: Ref<HTMLInputElement>;
  disabled?: boolean;
}

/** One RD coordinate: axis label and 6 digit boxes (input-otp keeps paste, the numeric keyboard and focus handling). */
export default function DigitBoxes({ id, label, bad, ...field }: DigitBoxesProps) {
  return (
    <div className="grid grid-cols-[20px_1fr] items-center gap-1">
      <label htmlFor={id} className="text-sm font-bold text-muted-foreground">{label}</label>
      <OTPInput
        id={id}
        autoComplete="off"
        inputMode="numeric"
        maxLength={6}
        pattern={REGEXP_ONLY_DIGITS}
        aria-invalid={bad || undefined}
        containerClassName="grid grid-cols-6 gap-1"
        {...field}
      >
        {[0, 1, 2, 3, 4, 5].map((index) => <DigitSlot key={index} index={index} bad={bad} />)}
      </OTPInput>
    </div>
  );
}

/** Card-coloured box; the box being typed in gets a primary ring, filled boxes an orange (or red) tonal fill. */
function DigitSlot({ index, bad }: { index: number; bad: boolean }) {
  const { char, hasFakeCaret, isActive } = useContext(OTPInputContext).slots[index];
  return (
    <div
      className={cn(
        'relative flex h-[46px] items-center justify-center rounded-[10px] text-[22px] font-semibold tabular-nums transition-[background-color,color,box-shadow] duration-150',
        !char ? 'bg-card' : bad ? 'bg-fox-error-container text-fox-on-error' : 'bg-primary-container text-on-primary-container',
        isActive && 'shadow-[inset_0_0_0_2px_var(--primary)]',
      )}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-5 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  );
}
