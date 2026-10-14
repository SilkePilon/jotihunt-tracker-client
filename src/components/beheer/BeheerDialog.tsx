import { useEffect, useState, type ComponentType, type RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  MapPinIcon,
  MegaphoneIcon,
  MonitorIcon,
  PlugIcon,
  SlidersHorizontalIcon,
  UserPlusIcon,
  UsersIcon,
} from 'lucide-react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import type { MapRef } from '@/components/Map';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { useAdmin } from '@/hooks/admin.hook';
import { useDevices } from '@/hooks/devices.hook';
import { useInvites } from '@/hooks/invites.hook';
import { useIsMobile } from '@/hooks/media.hook';
import { EASE_OUT, SWAP } from '@/lib/motion';
import { cn } from '@/lib/utils';
import useAdminStore, { type AdminDialogId } from '@/stores/admin.store';
import type { User } from '@/types/User';
import AlgemeenPane from './AlgemeenPane';
import { BeheerPane } from './BeheerLayout';
import HuntersPane from './HuntersPane';
import UsersPane from './UsersPane';

interface BeheerDialogProps {
  /** For the Hunters pane's "Op kaart" */
  mapRef: RefObject<MapRef | null>;
}

const SECTIONS: { id: AdminDialogId; title: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'algemeen', title: 'Algemeen', icon: SlidersHorizontalIcon },
  { id: 'users', title: 'Gebruikers', icon: UsersIcon },
  { id: 'invites', title: 'Invites', icon: UserPlusIcon },
  { id: 'hunters', title: 'Hunters', icon: MapPinIcon },
  { id: 'broadcast', title: 'Bericht versturen', icon: MegaphoneIcon },
  { id: 'koppelingen', title: 'Koppelingen', icon: PlugIcon },
];

const titleOf = (id: AdminDialogId) => SECTIONS.find((section) => section.id === id)?.title ?? '';

/** Phone: the list slides out one way and the pane in from the other (and back) */
const SLIDE = {
  enter: (direction: number) => ({ opacity: 0, x: 24 * direction }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: -24 * direction }),
};
const SLIDE_TRANSITION = { duration: 0.22, ease: EASE_OUT };
/** Keyboard focus ring of the menu buttons (as on the shadcn buttons) */
const FOCUS_RING = 'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

function openHq() {
  window.open('/hq', '_blank', 'noopener');
}

/** Gear menu → Beheer: settings, users, invites, hunters, broadcast and integrations in one window (admins only). */
export default function BeheerDialog({ mapRef }: BeheerDialogProps) {
  const user = useAuthUser<User>();
  const open = useAdminStore((state) => state.dialog !== null);
  const close = useAdminStore((state) => state.close);

  // The store is global: Layout unmounts on /login, and a window left open would pop up again after the next login
  useEffect(() => () => useAdminStore.getState().close(), []);

  if (!user?.admin) return null;
  return (
    <ResponsiveDialog
      open={open}
      onClose={close}
      title="Beheer"
      description="Instellingen, gebruikers, invites, hunters en koppelingen."
      hideHeader
      className="h-[600px] max-h-[85dvh] gap-0 overflow-hidden p-0 sm:max-w-[900px]"
    >
      <BeheerWindow mapRef={mapRef} />
    </ResponsiveDialog>
  );
}

/** The window's content; only mounted while the window is open (or closing), so the counts are only fetched then. */
function BeheerWindow({ mapRef }: BeheerDialogProps) {
  const isMobile = useIsMobile();
  const dialog = useAdminStore((state) => state.dialog);
  const openDialog = useAdminStore((state) => state.openDialog);

  // Keeps the last section while the window closes (the store is already null then)
  const [section, setSection] = useState<AdminDialogId>(dialog ?? 'algemeen');
  // Phone: the list first, unless the window was opened on a specific section (e.g. the /users route)
  const startView = (opened: AdminDialogId | null) => (opened && opened !== 'algemeen' ? 'pane' : 'list');
  const [phoneView, setPhoneView] = useState<'list' | 'pane'>(startView(dialog));
  const [direction, setDirection] = useState(1);
  if (dialog && dialog !== section) {
    setSection(dialog);
    // Phone: a section opened from elsewhere while the list shows (e.g. the /users route) shows that pane
    if (dialog !== 'algemeen') {
      setDirection(1);
      setPhoneView('pane');
    }
  }
  // Reopened before the close finished (the content stays mounted then): start over like a fresh open
  const open = dialog !== null;
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setPhoneView(startView(dialog));
  }

  const counts = useCounts();

  function select(id: AdminDialogId) {
    openDialog(id);
    setDirection(1);
    setPhoneView('pane');
  }

  function back() {
    setDirection(-1);
    setPhoneView('list');
  }

  const pane = <SectionPane section={section} mapRef={mapRef} />;

  if (isMobile) {
    return (
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        {phoneView === 'list' ? (
          <motion.div
            key="list"
            className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto"
            custom={direction}
            variants={SLIDE}
            initial="enter"
            animate="center"
            exit="exit"
            transition={SLIDE_TRANSITION}
          >
            <div className="px-3 pb-2 pt-1 text-lg font-semibold">Beheer</div>
            {SECTIONS.map(({ id, title, icon: Icon }) => (
              <button key={id} type="button" className={cn('flex items-center gap-3 rounded-md px-3 py-3 text-left text-sm active:bg-accent', FOCUS_RING)} onClick={() => select(id)}>
                <Icon className="size-4 text-muted-foreground" />
                {title}
                <Count value={counts[id]} />
              </button>
            ))}
            <button type="button" className={cn('mt-auto flex items-center gap-3 rounded-md px-3 py-3 text-left text-sm active:bg-accent', FOCUS_RING)} onClick={openHq}>
              <MonitorIcon className="size-4 text-muted-foreground" />
              HQ-scherm
              <ExternalLinkIcon className="ml-auto size-3.5 text-muted-foreground" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="pane"
            className="flex min-h-0 flex-1 flex-col"
            custom={direction}
            variants={SLIDE}
            initial="enter"
            animate="center"
            exit="exit"
            transition={SLIDE_TRANSITION}
          >
            <div className="flex items-center gap-2 pb-3">
              <Button variant="ghost" size="icon-sm" aria-label="Terug" onClick={back}>
                <ArrowLeftIcon />
              </Button>
              <span className="text-lg font-semibold">{titleOf(section)}</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-4">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={section} {...SWAP}>
                  {pane}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[210px_1fr] grid-rows-[minmax(0,1fr)]">
      <nav className="flex flex-col gap-0.5 border-r bg-muted/30 p-3" aria-label="Beheer">
        <div className="px-2 pb-2 pt-1 text-sm font-semibold">Beheer</div>
        {SECTIONS.map(({ id, title, icon: Icon }) => {
          const active = id === section;
          return (
            <button
              key={id}
              type="button"
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground',
                FOCUS_RING,
                active && 'bg-accent font-medium text-foreground hover:bg-accent',
              )}
              onClick={() => openDialog(id)}
            >
              <Icon className="size-4" />
              {title}
              <Count value={counts[id]} />
            </button>
          );
        })}
        <button
          type="button"
          className={cn(
            'mt-auto flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground',
            FOCUS_RING,
          )}
          onClick={openHq}
        >
          <MonitorIcon className="size-4" />
          HQ-scherm
          <ExternalLinkIcon className="ml-auto size-3.5" />
        </button>
      </nav>
      <div className="min-h-0 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={section} className="h-full overflow-y-auto p-8" {...SWAP}>
            {pane}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Menu counts; undefined (shows nothing) until known. */
function useCounts(): Partial<Record<AdminDialogId, number>> {
  const { users } = useAdmin();
  const { invites } = useInvites(true);
  const { devices } = useDevices();
  return {
    users: users?.length,
    invites: invites?.filter((invite) => invite.state === 'active').length,
    hunters: devices?.length,
  };
}

/** Fades in once the number is known */
function Count({ value }: { value: number | undefined }) {
  return (
    <AnimatePresence initial={false}>
      {value !== undefined && (
        <motion.span key="count" className="ml-auto text-xs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {value}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function SectionPane({ section, mapRef }: { section: AdminDialogId; mapRef: RefObject<MapRef | null> }) {
  switch (section) {
    case 'algemeen':
      return <AlgemeenPane />;
    case 'users':
      return <UsersPane />;
    case 'hunters':
      return <HuntersPane mapRef={mapRef} />;
    default:
      return <PlaceholderPane title={titleOf(section)} />;
  }
}

/** Sections that are not built yet */
function PlaceholderPane({ title }: { title: string }) {
  return (
    <BeheerPane title={title} description="Komt eraan.">
      {null}
    </BeheerPane>
  );
}
