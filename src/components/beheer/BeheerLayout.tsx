import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { AnimatePresence, motion, useIsPresent } from 'motion/react';
import { ChevronDownIcon, Loader2Icon, TriangleAlertIcon } from 'lucide-react';
import LoadError from '@/components/LoadError';
import AutoHeight from '@/components/motion/AutoHeight';
import Reveal from '@/components/motion/Reveal';
import { useIsMobile } from '@/hooks/media.hook';
import { focusDropped, neighbourIndex } from '@/lib/focus';
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
  const heading =
    title !== undefined ? (
      <>
        {title}
        {count !== undefined && (
          <span className="font-semibold text-muted-foreground">
            {' · '}
            <CountSwap value={count} />
          </span>
        )}
      </>
    ) : null;

  let header: ReactNode = null;
  if (heading && onToggle) {
    // The toggle sits inside the heading (a heading inside a button isn't valid HTML); spans only, as a button holds phrasing content
    header = (
      <h3 className="text-[15px] font-bold">
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          data-card-heading
          className="flex w-full items-center gap-2.5 rounded-2xl px-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          <span className="block min-w-0 flex-1">
            <span className="block">{heading}</span>
            {description && <span className="block text-xs font-normal text-muted-foreground">{description}</span>}
          </span>
          {right}
          <Chevron open={open} />
        </button>
      </h3>
    );
  } else if (heading) {
    header = (
      <div className="mx-1 flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          {/* tabIndex -1: focus lands here when the row or question that held it in the card is gone */}
          <h3 data-card-heading tabIndex={-1} className="text-[15px] font-bold outline-none">
            {heading}
          </h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {right}
      </div>
    );
  }

  return (
    // isolate: the pills' 44px touch areas on phones (COARSE_HIT_AREA) stay above the card's background
    <section className={cn('isolate rounded-3xl bg-card p-4', className)}>
      {header}
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
 * and out (children must be keyed rows); at most one BeheerExpandableRow inside is open. Pass `openId` +
 * `onOpenIdChange` to control which one (e.g. a window that opens on a given row).
 */
export function BeheerRows({ children, className, openId: controlledOpenId, onOpenIdChange }: { children: ReactNode; className?: string; openId?: string | null; onOpenIdChange?: (id: string | null) => void }) {
  const [ownOpenId, setOwnOpenId] = useState<string | null>(null);
  const openId = controlledOpenId !== undefined ? controlledOpenId : ownOpenId;
  const setOpenId = onOpenIdChange ?? setOwnOpenId;
  return (
    <RowsContext.Provider value={{ openId, setOpenId }}>
      <div className={cn('flex flex-col gap-0.5', className)}>
        <AnimatePresence initial={false}>{children}</AnimatePresence>
      </div>
    </RowsContext.Provider>
  );
}

export type RowTone = 'default' | 'open' | 'danger' | 'muted' | 'shown';

const TONE: Record<RowTone, string> = {
  default: 'bg-beheer-row',
  open: 'bg-beheer-row-high',
  danger: 'bg-destructive/12',
  // motion owns the block's opacity (fold in/out), so dim the content instead
  muted: 'bg-beheer-row [&>*]:opacity-60',
  // The edition everyone sees (soft orange, like primary pills)
  shown: 'bg-primary-container text-on-primary-container [&_.text-muted-foreground]:text-on-primary-container/75',
};

/**
 * The tonal block every row kind sits in: folds in and away (height + opacity). The padding sits inside, so the height
 * animates to zero without a jump. `className` goes on the block (e.g. the new-invite ring).
 */
export function RowFrame({ tone = 'default', className, children, ref, exiting }: { tone?: RowTone; className?: string; children: ReactNode; ref?: Ref<HTMLDivElement>; exiting?: boolean }) {
  return (
    <motion.div
      // isolate: the pills' 44px touch areas on phones (COARSE_HIT_AREA) stay above the block's background
      className={cn('isolate overflow-hidden rounded-(--radius-segment) transition-colors duration-200 first:rounded-t-2xl last:rounded-b-2xl', TONE[tone], className)}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={REVEAL_TRANSITION}
      ref={ref}
      // Skipped when focus moves on from a row that goes away (focusNeighbourRow)
      data-exiting={exiting || undefined}
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
  /** Controls on their own full-width line under the text (e.g. on phones, where they don't fit beside it) */
  below?: ReactNode;
  tone?: RowTone;
  className?: string;
}

/** One row: optional leading element, title, muted meta, trailing controls. Put it in BeheerRows with a key. */
export function BeheerRow({ leading, title, meta, children, below, tone, className }: BeheerRowProps) {
  return (
    <RowFrame tone={tone} className={className}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <RowContent leading={leading} title={title} meta={meta} trailing={children} />
      </div>
      {below && <div className="-mt-1 flex items-center gap-1.5 px-3 pb-2.5">{below}</div>}
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
  /** Replaces the unfolded part's classes (default: a wrapping row of pills), e.g. a column of photo, facts and actions */
  bodyClassName?: string;
  /** The header isn't a button while true (e.g. while it holds the rename input) */
  headerStatic?: boolean;
  /** Replaces the whole row with this (e.g. an InlineConfirm): the row turns red and the content swaps */
  confirm?: ReactNode;
  className?: string;
}

/** A row that opens on tap (chevron turns); the open part unfolds under the row content and holds action pills. */
export function BeheerExpandableRow({ id, leading, title, meta, trailing, children, indentClassName, bodyClassName, headerStatic, confirm, className }: BeheerExpandableRowProps) {
  const rows = useContext(RowsContext);
  const isPresent = useIsPresent();
  const frame = useRef<HTMLDivElement>(null);
  const headerButton = useRef<HTMLButtonElement | null>(null);
  // Set when a question closed while it held focus: the header takes it once it is back (after the question faded out)
  const refocusHeader = useRef(false);
  const was = useRef({ confirm: !!confirm, headerStatic: !!headerStatic });

  // A question (InlineConfirm) or an inline edit (rename) that ends takes focus with it: give it to the row's header
  useLayoutEffect(() => {
    const confirmGone = was.current.confirm && !confirm;
    const editGone = was.current.headerStatic && !headerStatic;
    was.current = { confirm: !!confirm, headerStatic: !!headerStatic };
    if ((!confirmGone && !editGone) || !holdsFocus(frame.current)) return;
    if (headerButton.current && !confirmGone) headerButton.current.focus();
    else refocusHeader.current = true;
  }, [confirm, headerStatic]);

  const headerRef = useCallback((button: HTMLButtonElement | null) => {
    headerButton.current = button;
    if (!button || !refocusHeader.current) return;
    refocusHeader.current = false;
    if (holdsFocus(frame.current)) button.focus();
  }, []);

  // The row goes away (e.g. deleted) while it holds focus: hand it to the next row, else the previous, else the card heading
  useLayoutEffect(() => {
    if (!isPresent && frame.current?.contains(document.activeElement)) focusNeighbourRow(frame.current);
  }, [isPresent]);

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
    <RowFrame ref={frame} exiting={!isPresent} tone={confirm ? 'danger' : open ? 'open' : 'default'} className={className}>
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
                  ref={headerRef}
                  type="button"
                  aria-expanded={open}
                  data-row-header
                  onClick={toggle}
                  className={cn(headerClass, 'outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset')}
                >
                  {header}
                </button>
              )}
              {/* pt-1 and the side/bottom padding leave room for the pills' 3px focus ring: Reveal and the row clip */}
              <Reveal>{open && <div className={bodyClassName ?? cn('flex flex-wrap items-center gap-1.5 px-3 pt-1 pb-3', indentClassName)}>{children}</div>}</Reveal>
            </motion.div>
          )}
        </AnimatePresence>
      </AutoHeight>
    </RowFrame>
  );
}

/** Whether the element holds focus, or focus was just dropped (on <body>) by a change inside it */
function holdsFocus(element: HTMLElement | null): boolean {
  return !!element && (element.contains(document.activeElement) || focusDropped(document.activeElement, document.body));
}

/** Focuses a card's heading (its toggle when it has one); false when the card is gone. */
function focusCardHeading(section: Element | null): boolean {
  const heading = section?.isConnected ? section.querySelector<HTMLElement>('[data-card-heading]') : null;
  heading?.focus();
  return !!heading;
}

/** A row that holds focus goes away: focus the next row's header (or first control), else the previous one's, else the card heading. */
function focusNeighbourRow(frame: HTMLElement) {
  const frames = Array.from(frame.parentElement?.children ?? []);
  const targets = frames.map((row) =>
    row instanceof HTMLElement && row !== frame && row.dataset.exiting === undefined
      ? row.querySelector<HTMLElement>('[data-row-header], button:not(:disabled), a[href], input:not(:disabled)')
      : null,
  );
  const index = neighbourIndex(targets.map(Boolean), frames.indexOf(frame));
  if (index >= 0) targets[index]?.focus();
  else focusCardHeading(frame.closest('section'));
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
  const box = useRef<HTMLDivElement>(null);
  // The control that asked (focused while the question appears), to give focus back to when the question goes
  const [opener] = useState(() => (document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null));

  // Gone (cancelled, or done) with focus lost along with it: back to the opener, else the card's heading. A row's
  // question needs neither: BeheerExpandableRow already gave focus to its header (or the next row).
  useEffect(() => {
    const section = box.current?.closest('section') ?? null;
    return () => {
      if (!focusDropped(document.activeElement, document.body)) return;
      if (opener?.isConnected && !opener.matches(':disabled')) opener.focus();
      else focusCardHeading(section);
    };
  }, [opener]);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    // Escape cancels the question; data-inline-edit on its buttons keeps the window open meanwhile (keepOpenWhileEditing)
    <div
      ref={box}
      role="alertdialog"
      aria-label={typeof title === 'string' ? title : undefined}
      className={cn('flex flex-wrap items-center gap-3', className)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) onCancel();
      }}
    >
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-[13.5px] font-bold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        {/* busy, not disabled: disabling the pill that has focus would drop it */}
        <Pill variant="secondary" data-inline-edit onClick={onCancel} busy={busy} autoFocus>
          Annuleer
        </Pill>
        <Pill variant="danger" data-inline-edit morphKey={busy ? 'busy' : 'idle'} onClick={() => void confirm()} busy={busy}>
          {busy ? <Loader2Icon className="animate-spin" /> : confirmIcon}
          {confirmLabel}
        </Pill>
      </div>
    </div>
  );
}

// In its own small module, so the Beheer window's loading fallback (outside the lazy chunk) can use it too
export { BeheerSkeleton } from './BeheerSkeleton';

/** A pane whose data failed to load (nothing to show yet): a card with the problem and "Opnieuw proberen". */
export function BeheerLoadError({ message, onRetry }: { message: string; onRetry: () => unknown }) {
  return (
    <section className="rounded-3xl bg-card p-4">
      <LoadError className="px-1 text-[13px]" message={message} onRetry={onRetry} />
    </section>
  );
}

/** Amber problem bar, as in the Koppelingen cards; folds in and out. */
export function WarnBar({ children }: { children: ReactNode }) {
  return (
    <motion.div className="overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={REVEAL_TRANSITION}>
      <div className="mt-2.5 flex items-center gap-2.5 rounded-2xl bg-amber-500/15 px-3 py-2.5 text-[12.5px] text-amber-800 dark:text-amber-200">
        <TriangleAlertIcon className="size-4 shrink-0" />
        <span className="flex-1">{children}</span>
      </div>
    </motion.div>
  );
}
