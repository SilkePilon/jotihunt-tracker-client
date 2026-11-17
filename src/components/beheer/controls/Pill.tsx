import type { ComponentProps, ReactNode } from 'react';
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react';
import { cva, type VariantProps } from 'class-variance-authority';
import { SWAP_TRANSITION } from '@/lib/motion';
import { COARSE_HIT_AREA } from '@/lib/hit-area';
import { cn } from '@/lib/utils';

// Both sizes are under 44px: COARSE_HIT_AREA grows the touch area on phones (give the row/card `isolate`)
const pill = cva(
  [
    COARSE_HIT_AREA,
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        primary: 'bg-primary-container text-on-primary-container hover:bg-[color-mix(in_oklab,var(--on-primary-container)_10%,var(--primary-container))]',
        secondary: 'bg-beheer-row-high text-foreground hover:bg-beheer-row-high/70',
        ghost: 'text-muted-foreground hover:bg-beheer-row-high hover:text-foreground',
        'danger-soft': 'bg-destructive/15 text-destructive-text hover:bg-destructive/20',
        'danger-outline':
          'text-destructive-text shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,var(--destructive)_60%,transparent)] hover:bg-destructive/10',
        danger: 'bg-destructive text-white hover:bg-destructive/90',
        success: 'bg-green-500/20 text-green-800 dark:text-green-300',
        warn: 'bg-amber-700 text-white hover:bg-amber-700/90',
        // teal-800 / green-800: >= 4.5:1 on their tinted fills in light mode (green-700 and WhatsApp's #128C7E were below)
        whatsapp: 'bg-[#25D366]/15 text-teal-800 hover:bg-[#25D366]/25 dark:text-[#4ade80]',
      },
      size: {
        sm: 'h-8 px-3 text-[12.5px]',
        md: 'h-9 px-4 text-[13px]',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'sm' },
  },
);

type PillProps = Omit<HTMLMotionProps<'button'>, 'children'> &
  VariantProps<typeof pill> & {
    children: ReactNode;
    /**
     * Set when the label changes between states (e.g. "Versturen…" → "Verstuurd"): the old label swaps out and the pill
     * eases to its new width. Leave undefined for a pill whose label never changes.
     */
    morphKey?: string;
    /**
     * Working on it (saving, sending): looks disabled and ignores clicks, but stays focusable (aria-disabled), so a
     * keyboard or screen-reader user keeps their place. Use `disabled` only for a pill that can't be used at all.
     */
    busy?: boolean;
  };

/** Beheer's text button: a full pill. */
export function Pill({ variant, size, className, children, morphKey, style, busy, onClick, type = 'button', 'aria-disabled': ariaDisabled, ...props }: PillProps) {
  const inert = busy || ariaDisabled === true || ariaDisabled === 'true';
  return (
    <motion.button
      type={type}
      aria-disabled={inert || undefined}
      aria-busy={busy || undefined}
      // preventDefault: a busy submit pill doesn't submit its form either
      onClick={inert ? (event) => event.preventDefault() : onClick}
      layout={morphKey !== undefined}
      // Set as a style so motion corrects the corners while the width animates
      style={{ borderRadius: 12, ...style }}
      className={cn(pill({ variant, size }), className)}
      {...props}
    >
      {morphKey === undefined ? (
        children
      ) : (
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={morphKey}
            layout="position"
            className="inline-flex items-center gap-1.5"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={SWAP_TRANSITION}
          >
            {children}
          </motion.span>
        </AnimatePresence>
      )}
    </motion.button>
  );
}

const iconPill = cva(
  [
    COARSE_HIT_AREA,
    "inline-grid size-[34px] shrink-0 place-items-center rounded-lg outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        ghost: 'text-muted-foreground hover:bg-beheer-row-high hover:text-foreground',
        soft: 'bg-beheer-row-high text-foreground hover:bg-beheer-row-high/70',
        success: 'bg-green-500/20 text-green-800 dark:text-green-300',
        active: 'bg-primary/20 text-orange-800 dark:text-orange-300',
        'danger-soft': 'bg-destructive/15 text-destructive-text hover:bg-destructive/20',
      },
    },
    defaultVariants: { variant: 'ghost' },
  },
);

/** Round 34px icon button; always give it an aria-label. */
export function IconPill({ variant, className, type = 'button', ...props }: ComponentProps<'button'> & VariantProps<typeof iconPill> & { 'aria-label': string }) {
  return <button type={type} className={cn(iconPill({ variant }), className)} {...props} />;
}

const tag = cva('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs leading-4 font-extrabold md:text-[10.5px] transition-colors duration-300 [&_svg]:size-3', {
  variants: {
    tone: {
      // -800 in light: the small (12px phone, 10.5px desktop) text needs >= 4.5:1 on its tint over the rows (-700 was below)
      primary: 'bg-primary/20 text-orange-800 dark:text-orange-300',
      neutral: 'bg-beheer-row-high text-muted-foreground',
      ok: 'bg-green-500/15 text-green-800 dark:text-green-300',
      warn: 'bg-amber-500/20 text-amber-800 dark:text-amber-300',
      info: 'bg-sky-500/15 text-sky-800 dark:text-sky-300',
      danger: 'bg-destructive/15 text-destructive-text',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

/** Small pill next to a name or title: "Admin", "jij", "vol", "Verbonden". */
export function Tag({ tone, className, children }: VariantProps<typeof tag> & { className?: string; children: ReactNode }) {
  return <span className={cn(tag({ tone }), className)}>{children}</span>;
}
