import type { ComponentProps, ReactNode } from 'react';
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react';
import { cva, type VariantProps } from 'class-variance-authority';
import { SWAP_TRANSITION } from '@/lib/motion';
import { cn } from '@/lib/utils';

const pill = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-beheer-row-high text-foreground hover:bg-beheer-row-high/70',
        'danger-soft': 'bg-destructive/15 text-destructive hover:bg-destructive/20 dark:text-red-300',
        'danger-outline':
          'text-destructive shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,var(--destructive)_60%,transparent)] hover:bg-destructive/10 dark:text-red-300',
        danger: 'bg-destructive text-white hover:bg-destructive/90',
        success: 'bg-green-500/20 text-green-700 dark:text-green-300',
        warn: 'bg-amber-700 text-white hover:bg-amber-700/90',
        whatsapp: 'bg-[#25D366]/15 text-[#128C7E] hover:bg-[#25D366]/25 dark:text-[#4ade80]',
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
  };

/** Beheer's text button: a full pill. */
export function Pill({ variant, size, className, children, morphKey, style, type = 'button', ...props }: PillProps) {
  return (
    <motion.button
      type={type}
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
  "inline-grid size-[34px] shrink-0 place-items-center rounded-lg outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        ghost: 'text-muted-foreground hover:bg-beheer-row-high hover:text-foreground',
        soft: 'bg-beheer-row-high text-foreground hover:bg-beheer-row-high/70',
        success: 'bg-green-500/20 text-green-700 dark:text-green-300',
        active: 'bg-primary/20 text-orange-700 dark:text-orange-300',
        'danger-soft': 'bg-destructive/15 text-destructive hover:bg-destructive/20 dark:text-red-300',
      },
    },
    defaultVariants: { variant: 'ghost' },
  },
);

/** Round 34px icon button; always give it an aria-label. */
export function IconPill({ variant, className, type = 'button', ...props }: ComponentProps<'button'> & VariantProps<typeof iconPill> & { 'aria-label': string }) {
  return <button type={type} className={cn(iconPill({ variant }), className)} {...props} />;
}

const tag = cva('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] leading-4 font-extrabold [&_svg]:size-3', {
  variants: {
    tone: {
      primary: 'bg-primary/20 text-orange-700 dark:text-orange-300',
      neutral: 'bg-beheer-row-high text-muted-foreground',
      ok: 'bg-green-500/15 text-green-700 dark:text-green-300',
      warn: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

/** Small pill next to a name or title: "Admin", "jij", "vol", "Verbonden". */
export function Tag({ tone, className, children }: VariantProps<typeof tag> & { className?: string; children: ReactNode }) {
  return <span className={cn(tag({ tone }), className)}>{children}</span>;
}
