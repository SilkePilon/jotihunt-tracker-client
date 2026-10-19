import { useContext, type Ref } from 'react';
import { OTPInput, OTPInputContext } from 'input-otp';
import { sanitizeDigits } from '@/lib/hint-guess';
import { cn } from '@/lib/utils';

interface DigitBoxesProps {
  id: string;
  /** "X" or "Y" */
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  /** All 6 boxes filled (digits or '?'): move focus on */
  onComplete: () => void;
  /** Outside the Netherlands or rejected: filled boxes turn red */
  bad: boolean;
  ref?: Ref<HTMLInputElement>;
  disabled?: boolean;
}

/**
 * One RD coordinate: axis label and 6 digit boxes (input-otp keeps paste, the keyboard and focus handling). A box also
 * takes '?' for an unknown digit; '.', ',', '*', '-' and space become '?' too (a phone's number pad has no '?').
 */
export default function DigitBoxes({ id, label, bad, onChange, ...field }: DigitBoxesProps) {
  return (
    <div className="grid grid-cols-[16px_1fr] items-center gap-1">
      <label htmlFor={id} className="text-xs font-bold text-muted-foreground">{label}</label>
      <OTPInput
        id={id}
        autoComplete="off"
        // decimal: the number pad with a '.' or ',' key for unknown digits
        inputMode="decimal"
        maxLength={6}
        aria-invalid={bad || undefined}
        containerClassName="grid grid-cols-6 gap-1"
        onChange={(value) => onChange(sanitizeDigits(value))}
        {...field}
      >
        {[0, 1, 2, 3, 4, 5].map((index) => <DigitSlot key={index} index={index} bad={bad} />)}
      </OTPInput>
    </div>
  );
}

/** Card-coloured box; the box being typed in gets a primary ring, filled boxes an orange (or red) tonal fill, an unknown digit a dashed purple one. */
function DigitSlot({ index, bad }: { index: number; bad: boolean }) {
  const { char, hasFakeCaret, isActive } = useContext(OTPInputContext).slots[index];
  return (
    <div
      className={cn(
        'relative flex h-9 items-center justify-center rounded-lg text-lg font-semibold tabular-nums transition-[background-color,color,box-shadow] duration-150',
        !char
          ? 'bg-card'
          : char === '?'
            ? 'bg-guess-container text-on-guess-container [outline:1.5px_dashed_var(--guess)] [outline-offset:-1.5px]'
            : bad
              ? 'bg-fox-error-container text-fox-on-error'
              : 'bg-primary-container text-on-primary-container',
        isActive && 'shadow-[inset_0_0_0_2px_var(--primary)]',
      )}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  );
}
