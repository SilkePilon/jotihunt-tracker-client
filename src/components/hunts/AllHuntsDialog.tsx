import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeftIcon, InboxIcon, ListIcon, SendIcon, StarIcon } from 'lucide-react';
import { BeheerCard, BeheerPane, BeheerRows, CountSwap } from '@/components/beheer/BeheerLayout';
import { IconPill, Pill } from '@/components/beheer/controls/Pill';
import { NavItem, type NavIcon } from '@/components/beheer/WindowNav';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { useHunts } from '@/hooks/hunts.hook';
import { useIsMobile } from '@/hooks/media.hook';
import { HUNT_FILTER_LABELS, HUNT_FILTERS, huntAreaTotals, huntFilterCounts, huntItemArea, huntItemKey, huntItemPoints, matchesHuntFilter, type HuntFilter } from '@/lib/hunt-list';
import { huntListItems } from '@/lib/hunt-reports';
import { PANE_SLIDE, PANE_SLIDE_TRANSITION, SWAP } from '@/lib/motion';
import { cn, getColorFromArea } from '@/lib/utils';
import HuntListRow from './HuntListRow';

/** Rows rendered at first (and added per "Meer laden"), so a long list opens quickly. */
const PAGE_SIZE = 200;

const FILTER_ICONS: Record<HuntFilter, NavIcon> = { all: ListIcon, pending: SendIcon, submitted: InboxIcon, judged: StarIcon };

/** What the list shows: a status filter, or one area (then the status filter is "all"). */
interface View {
  filter: HuntFilter;
  area: string | null;
}
const ALL: View = { filter: 'all', area: null };

/** Count right of a nav item; "Te versturen" in orange while there is work. */
function NavCount({ value, hot }: { value: number; hot?: boolean }) {
  return (
    <span className={cn('ml-auto text-xs font-bold', hot && value > 0 ? 'text-orange-700 dark:text-orange-300' : 'text-muted-foreground')}>
      <CountSwap value={value} />
    </span>
  );
}

/** Every hunt (own reports plus website-only hunts) in a Beheer-style window: status filters and areas on the left, rows that open in place. */
export default function AllHuntsDialog({ open, onOpenChange, initialReportId }: { open: boolean; onOpenChange: (open: boolean) => void; initialReportId?: string }) {
  return (
    <ResponsiveDialog
      open={open}
      onClose={() => onOpenChange(false)}
      title="Alle hunts"
      description="Alle geregistreerde hunts en hunts van jotihunt.nl."
      hideHeader
      className="h-[640px] max-h-[85dvh] gap-0 overflow-hidden bg-beheer-window p-0 sm:max-w-[960px] sm:rounded-[20px]"
      drawerClassName="bg-beheer-window"
    >
      <AllHuntsWindow open={open} initialReportId={initialReportId} />
    </ResponsiveDialog>
  );
}

/** The window's content; only mounted while the window is open (or closing). */
function AllHuntsWindow({ open, initialReportId }: { open: boolean; initialReportId?: string }) {
  const isMobile = useIsMobile();
  const { reports } = useHuntReports();
  const { hunts } = useHunts();
  const items = useMemo(() => huntListItems(reports, hunts), [reports, hunts]);
  const [view, setView] = useState<View>(ALL);
  const [openId, setOpenId] = useState<string | null>(initialReportId ?? null);
  /** Pages added with "Meer laden" */
  const [extraPages, setExtraPages] = useState(0);
  // Phone: the nav list first, unless the window was opened on a hunt
  const [phoneView, setPhoneView] = useState<'list' | 'pane'>(initialReportId ? 'pane' : 'list');
  const [direction, setDirection] = useState(1);
  // Reopened before the close finished (the content stays mounted then): start over like a fresh open
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setView(ALL);
      setOpenId(initialReportId ?? null);
      setExtraPages(0);
      setPhoneView(initialReportId ? 'pane' : 'list');
    }
  }

  const counts = useMemo(() => huntFilterCounts(items), [items]);
  const areas = useMemo(() => huntAreaTotals(items), [items]);
  const shown = useMemo(() => items.filter((item) => matchesHuntFilter(item, view.filter) && (!view.area || huntItemArea(item) === view.area)), [items, view]);
  // The hunt the window opened on must be on the first page
  const initialIndex = initialReportId ? shown.findIndex((item) => huntItemKey(item) === initialReportId) : -1;
  const limit = Math.max(PAGE_SIZE, initialIndex + 1) + extraPages * PAGE_SIZE;
  const points = shown.reduce((sum, item) => sum + huntItemPoints(item), 0);
  const title = view.area ? (areas.find((area) => area.area === view.area)?.label ?? view.area) : HUNT_FILTER_LABELS[view.filter];
  const description = `${shown.length} ${shown.length === 1 ? 'hunt' : 'hunts'} · ${view.area ? '' : 'totaal '}${points} pt`;

  function select(next: View) {
    setView(next);
    setOpenId(null);
    setExtraPages(0);
    setDirection(1);
    setPhoneView('pane');
  }

  function back() {
    setDirection(-1);
    setPhoneView('list');
  }

  const navItems = (phone: boolean) => (
    <>
      {HUNT_FILTERS.map((filter) => (
        <NavItem
          key={filter}
          icon={FILTER_ICONS[filter]}
          title={HUNT_FILTER_LABELS[filter]}
          active={!phone && !view.area && view.filter === filter}
          indicatorId={phone ? undefined : 'hunts-nav-active'}
          onClick={() => select({ filter, area: null })}
          trailing={<NavCount value={counts[filter]} hot={filter === 'pending'} />}
          className={phone ? 'h-12 text-foreground' : undefined}
        />
      ))}
      {areas.length > 0 && <div className="px-3 pt-[18px] pb-1.5 text-[10.5px] font-bold tracking-wider text-muted-foreground uppercase">Deelgebieden</div>}
      {areas.map((area) => (
        <NavItem
          key={area.area}
          leading={
            <span className="grid size-[18px] shrink-0 place-items-center">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: getColorFromArea(area.area) }} />
            </span>
          }
          title={area.label}
          active={!phone && view.area === area.area}
          indicatorId={phone ? undefined : 'hunts-nav-active'}
          // Picking the active area again clears it (desktop; on phones the nav is a fresh list each time)
          onClick={() => select(!phone && view.area === area.area ? ALL : { filter: 'all', area: area.area })}
          trailing={<span className="ml-auto text-xs font-bold text-muted-foreground tabular-nums">{area.points} pt</span>}
          className={phone ? 'h-11 text-foreground' : 'h-8 text-[13px]'}
        />
      ))}
    </>
  );

  const list = (
    <BeheerPane title={title} description={description}>
      <BeheerCard>
        {shown.length ? (
          <BeheerRows openId={openId} onOpenIdChange={setOpenId}>
            {shown.slice(0, limit).map((item) => (
              <HuntListRow key={huntItemKey(item)} item={item} />
            ))}
          </BeheerRows>
        ) : (
          <p className="py-8 text-center text-[13px] text-muted-foreground">Geen hunts in deze lijst.</p>
        )}
        {shown.length > limit && (
          <div className="flex justify-center pt-3">
            <Pill variant="secondary" onClick={() => setExtraPages((pages) => pages + 1)}>
              Meer laden ({shown.length - limit} over)
            </Pill>
          </div>
        )}
      </BeheerCard>
    </BeheerPane>
  );
  const viewKey = view.area ?? view.filter;

  if (isMobile) {
    return (
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        {phoneView === 'list' ? (
          <motion.nav
            key="list"
            aria-label="Hunts"
            className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto"
            custom={direction}
            variants={PANE_SLIDE}
            initial="enter"
            animate="center"
            exit="exit"
            transition={PANE_SLIDE_TRANSITION}
          >
            <div className="px-3 pt-1 pb-3 text-lg font-bold">Hunts</div>
            {navItems(true)}
          </motion.nav>
        ) : (
          <motion.div
            key="pane"
            className="flex min-h-0 flex-1 flex-col"
            custom={direction}
            variants={PANE_SLIDE}
            initial="enter"
            animate="center"
            exit="exit"
            transition={PANE_SLIDE_TRANSITION}
          >
            <div className="flex items-center gap-2 pb-3">
              <IconPill aria-label="Terug" onClick={back}>
                <ArrowLeftIcon />
              </IconPill>
              <span className="text-lg font-bold">{title}</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-4">{list}</div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr] grid-rows-[minmax(0,1fr)]">
      <nav className="flex flex-col gap-0.5 overflow-y-auto px-3 py-[18px]" aria-label="Hunts">
        <div className="px-3 pt-0.5 pb-3.5 text-[17px] font-bold">Hunts</div>
        {navItems(false)}
      </nav>
      <div className="min-h-0 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={viewKey} className="h-full overflow-y-auto px-7 py-6" {...SWAP}>
            {list}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
