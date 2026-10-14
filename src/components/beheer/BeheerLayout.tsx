import { createContext, useContext, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDownIcon, Loader2Icon } from 'lucide-react';
import AutoHeight from '@/components/motion/AutoHeight';
import Reveal from '@/components/motion/Reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/media.hook';
import { REVEAL_TRANSITION, SWAP, SWAP_TRANSITION } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Pill } from './controls/Pill';

/** Text that fades over when it changes; keyed by the text, so other content (e.g. a skeleton) counts as one state. */
export function FadeSwap({ children, className }: { children: ReactNode; className?: string }) {
  const key = typeof children === 'string' || typeof children === 'number' ? String(children) : 'node';
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={key} className={className} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** A count that rolls to its new value. */
export function CountSwap({ value }: { value: number }) {
  return (
    <span className="relative inline-flex overflow-hidden align-bottom tabular-nums">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={value} initial={{ y: '60%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '-60%', opacity: 0 }} transition={SWAP_TRANSITION}>
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Down chevron that turns over when open. */
export function Chevron({ open }: { open: boolean }) {
  return (
    <motion.span aria-hidden className="inline-grid shrink-0 text-muted-foreground" animate={{ rotate: open ? 180 : 0 }} transition={SWAP_TRANSITION}>
      <ChevronDownIcon className="size-4" />
    </motion.span>
  );
}

/** One Beheer section: 22px title and one muted line (plus an optional action on the right), then its cards 14px apart. */
export function BeheerPane({ title, description, action, children }: { title: string; description: ReactNode; action?: ReactNode; children: ReactNode }) {
  // On phones the back-arrow header above the pane already shows the title
  const isMobile = useIsMobile();
  return (
    <div className="flex flex-col">
      <div className="mb-[18px] flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className={isMobile ? 'sr-only' : 'text-[22px] leading-tight font-bold'}>{title}</h2>
          <FadeSwap className="mt-0.5 text-[13px] text-muted-foreground">{description}</FadeSwap>
        </div>
        {action}
      </div>
      <div className="flex flex-col gap-3.5">{children}</div>
    </div>
  );
}

interface BeheerCardProps {
  /** 15px bold; no icon. Leave out for a card that draws its own header (Koppelingen). */
  title?: string;
  /** Shown as "· n" after the title */
  count?: number;
  /** Muted line under the title */
  description?: ReactNode;
  /** Right of the header */
  right?: ReactNode;
  /** Makes the header a toggle (e.g. "Gestopt"): the body folds in/out and a chevron shows */
  onToggle?: () => void;
  open?: boolean;
  className?: string;
  children?: ReactNode;
}

/** Tonal card (bg-card, 24px corners): header row, then the body (rows, chips, a form). */
export function BeheerCard({ title, count, description, right, onToggle, open = false, className, children }: BeheerCardProps) {
  const header =
    title !== undefined ? (
      <>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold">
            {title}
            {count !== undefined && (
              <span className="font-semibold text-muted-foreground">
                {' · '}
                <CountSwap value={count} />
              </span>
            )}
          </h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {right}
        {onToggle && <Chevron open={open} />}
      </>
    ) : null;

  return (
    <section className={cn('rounded-3xl bg-card p-4', className)}>
      {header &&
        (onToggle ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={onToggle}
            className="flex w-full items-center gap-2.5 rounded-2xl px-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {header}
          </button>
        ) : (
          <div className="mx-1 flex items-center gap-2.5">{header}</div>
        ))}
      {onToggle ? (
        <Reveal>{open && <div className="pt-3">{children}</div>}</Reveal>
      ) : (
        children && <div className={header ? 'mt-3' : undefined}>{children}</div>
      )}
    </section>
  );
}

type RowsState = { openId: string | null; setOpenId: (id: string | null) => void };
const RowsContext = createContext<RowsState | null>(null);

/**
 * A card's rows: separate tonal blocks 2px apart, outer corners 16px and inner 6px (M3 segmented list). Rows fold in
 * and out (children must be keyed rows); at most one BeheerExpandableRow inside is open.
 */
export function BeheerRows({ children, className }: { children: ReactNode; className?: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <RowsContext.Provider value={{ openId, setOpenId }}>
      <div className={cn('flex flex-col gap-0.5', className)}>
        <AnimatePresence initial={false}>{children}</AnimatePresence>
      </div>
    </RowsContext.Provider>
  );
}

export type RowTone = 'default' | 'open' | 'danger' | 'muted';

const TONE: Record<RowTone, string> = {
  default: 'bg-beheer-row',
  open: 'bg-beheer-row-high',
  danger: 'bg-destructive/12',
  // motion owns the block's opacity (fold in/out), so dim the content instead
  muted: 'bg-beheer-row [&>*]:opacity-60',
};

/**
 * The tonal block every row kind sits in: folds in and away (height + opacity). The padding sits inside, so the height
 * animates to zero without a jump. `className` goes on the block (e.g. the new-invite ring).
 */
export function RowFrame({ tone = 'default', className, children }: { tone?: RowTone; className?: string; children: ReactNode }) {
  return (
    <motion.div
      className={cn('overflow-hidden rounded-md transition-colors duration-200 first:rounded-t-2xl last:rounded-b-2xl', TONE[tone], className)}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={REVEAL_TRANSITION}
    >
      {children}
    </motion.div>
  );
}

function RowContent({ leading, title, meta, trailing }: { leading?: ReactNode; title: ReactNode; meta?: ReactNode; trailing?: ReactNode }) {
  return (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5 text-[13.5px] font-semibold">{title}</div>
        {meta && <div className="text-xs text-muted-foreground">{meta}</div>}
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-1.5">{trailing}</div>}
    </>
  );
}

interface BeheerRowProps {
  /** E.g. a muted icon or the hunter marker; no avatar circles */
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  /** Trailing controls (pills, a switch, a tag) */
  children?: ReactNode;
  tone?: RowTone;
  className?: string;
}

/** One row: optional leading element, title, muted meta, trailing controls. Put it in BeheerRows with a key. */
export function BeheerRow({ leading, title, meta, children, tone, className }: BeheerRowProps) {
  return (
    <RowFrame tone={tone} className={className}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <RowContent leading={leading} title={title} meta={meta} trailing={children} />
      </div>
    </RowFrame>
  );
}

interface BeheerExpandableRowProps {
  /** Unique within its BeheerRows (one open row per card) */
  id: string;
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  /** Non-interactive extras before the chevron (e.g. the battery) */
  trailing?: ReactNode;
  /** The unfolded part: action pills */
  children: ReactNode;
  /** Full left padding of the unfolded part, lining it up with the text column: 12px row padding + leading width + 12px gap, e.g. "pl-8" */
  indentClassName?: string;
  /** The header isn't a button while true (e.g. while it holds the rename input) */
  headerStatic?: boolean;
  /** Replaces the whole row with this (e.g. an InlineConfirm): the row turns red and the content swaps */
  confirm?: ReactNode;
  className?: string;
}

/** A row that opens on tap (chevron turns); the open part unfolds under the row content and holds action pills. */
export function BeheerExpandableRow({ id, leading, title, meta, trailing, children, indentClassName, headerStatic, confirm, className }: BeheerExpandableRowProps) {
  const rows = useContext(RowsContext);
  const [ownOpen, setOwnOpen] = useState(false);
  const open = rows ? rows.openId === id : ownOpen;
  const toggle = () => (rows ? rows.setOpenId(open ? null : id) : setOwnOpen(!open));
  const headerClass = 'flex w-full items-center gap-3 px-3 py-2.5 text-left';
  const header = (
    <>
      <RowContent leading={leading} title={title} meta={meta} trailing={trailing} />
      <Chevron open={open} />
    </>
  );

  return (
    <RowFrame tone={confirm ? 'danger' : open ? 'open' : 'default'} className={className}>
      <AutoHeight scene={confirm ? 'confirm' : 'row'}>
        <AnimatePresence mode="wait" initial={false}>
          {confirm ? (
            <motion.div key="confirm" className="px-3 py-2.5" {...SWAP}>
              {confirm}
            </motion.div>
          ) : (
            <motion.div key="row" {...SWAP}>
              {headerStatic ? (
                <div className={headerClass}>{header}</div>
              ) : (
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={toggle}
                  className={cn(headerClass, 'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset')}
                >
                  {header}
                </button>
              )}
              <Reveal>{open && <div className={cn('flex flex-wrap items-center gap-1.5 px-3 pb-3', indentClassName)}>{children}</div>}</Reveal>
            </motion.div>
          )}
        </AnimatePresence>
      </AutoHeight>
    </RowFrame>
  );
}

interface InlineConfirmProps {
  /** Bold question, e.g. "Jesse verwijderen?" */
  title: ReactNode;
  /** Muted consequence line */
  description: ReactNode;
  confirmLabel: string;
  confirmIcon?: ReactNode;
  onCancel: () => void;
  /** Runs on confirm; both pills stay disabled (spinner) until it settles. Handle errors (toast) inside. */
  onConfirm: () => Promise<unknown> | unknown;
  /** E.g. the red box when it sits in a card instead of a row */
  className?: string;
}

/** A red-tinted question in place of a row or a card section: question, consequence, "Annuleer" + a destructive pill. */
export function InlineConfirm({ title, description, confirmLabel, confirmIcon, onCancel, onConfirm, className }: InlineConfirmProps) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="alertdialog" aria-label={typeof title === 'string' ? title : undefined} className={cn('flex flex-wrap items-center gap-3', className)}>
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-[13.5px] font-bold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Pill variant="secondary" onClick={onCancel} disabled={busy} autoFocus>
          Annuleer
        </Pill>
        <Pill variant="danger" morphKey={busy ? 'busy' : 'idle'} onClick={() => void confirm()} disabled={busy}>
          {busy ? <Loader2Icon className="animate-spin" /> : confirmIcon}
          {confirmLabel}
        </Pill>
      </div>
    </div>
  );
}

/** Stands in for a pane's cards while their data loads. */
export function BeheerSkeleton({ groups = 1 }: { groups?: number }) {
  return (
    <div className="flex flex-col gap-3.5">
      {Array.from({ length: groups }, (_, index) => (
        <div key={index} className="flex flex-col gap-3 rounded-3xl bg-card p-4">
          <Skeleton className="mx-1 h-5 w-28 bg-beheer-row-high" />
          <Skeleton className="h-28 w-full rounded-2xl bg-beheer-row" />
        </div>
      ))}
    </div>
  );
}
