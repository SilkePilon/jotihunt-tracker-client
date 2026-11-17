import { useContext, type Ref } from 'react';
import { OTPInput, OTPInputContext } from 'input-otp';
import { sanitizeDigits, splitPastedCoordinates, stripPasted } from '@/lib/hint-guess';
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
  /** Both coordinates pasted at once (12 digits, into either row): fill X and Y */
  onPastePair?: (x: string, y: string) => void;
}

/**
 * One RD coordinate: axis label and 6 digit boxes (input-otp keeps paste, the keyboard and focus handling). A box also
 * takes '?' for an unknown digit; '.', ',', '*', '-' and space become '?' too (a phone's number pad has no '?').
 * Pasted text is different: separators are dropped ("155.000" is 155000), and a pasted pair fills both rows.
 */
export default function DigitBoxes({ id, label, bad, onChange, onComplete, onPastePair, ...field }: DigitBoxesProps) {
  return (
    <div className="grid grid-cols-[16px_1fr] items-center gap-1">
      <label htmlFor={id} className="text-xs font-bold text-muted-foreground">
        {label}
        {/* Only "X" / "Y" is visible; the field's full name says what goes in */}
        <span className="sr-only">-coördinaat (RD, 6 cijfers, ? voor onbekend)</span>
      </label>
      <OTPInput
        id={id}
        autoComplete="off"
        // decimal: the number pad with a '.' or ',' key for unknown digits
        inputMode="decimal"
        maxLength={6}
        aria-invalid={bad || undefined}
        containerClassName="grid grid-cols-6 gap-1"
        onChange={(value) => onChange(sanitizeDigits(value))}
        // input-otp cuts a paste to 6 characters before onChange sees it: drop the separators first, so "155.000" isn't
        // "155?00". A pair leaves this row as it is here; onPaste (after input-otp's own handler) fills both rows.
        pasteTransformer={(pasted) => (onPastePair && splitPastedCoordinates(pasted).y !== null ? '' : stripPasted(pasted))}
        onPaste={(event) => {
          const { x, y } = splitPastedCoordinates(event.clipboardData.getData('text/plain'));
          if (onPastePair && y !== null) onPastePair(x, y);
        }}
        // input-otp completes on the raw value (before sanitizing), so six letters would move focus with an empty field
        onComplete={(value: string) => {
          if (sanitizeDigits(value).length === 6) onComplete();
        }}
        {...field}
      >
        {[0, 1, 2, 3, 4, 5].map((index) => <DigitSlot key={index} index={index} bad={bad} />)}
      </OTPInput>
    </div>
  );
}

/** Card-coloured box; the box being typed in gets the focus ring colour, filled boxes an orange (or red) tonal fill, an unknown digit a dashed purple one. */
function DigitSlot({ index, bad }: { index: number; bad: boolean }) {
  const { char, hasFakeCaret, isActive } = useContext(OTPInputContext).slots[index];
  return (
    <div
      className={cn(
        'relative flex h-9 items-center justify-center rounded-lg text-lg pointer-coarse:h-11 font-semibold tabular-nums transition-[background-color,color,box-shadow] duration-150',
        !char
          ? 'bg-card'
          : char === '?'
            ? 'bg-guess-container text-on-guess-container [outline:1.5px_dashed_var(--guess)] [outline-offset:-1.5px]'
            : bad
              ? 'bg-fox-error-container text-fox-on-error'
              : 'bg-primary-container text-on-primary-container',
        isActive && 'shadow-[inset_0_0_0_2px_var(--ring)]',
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
