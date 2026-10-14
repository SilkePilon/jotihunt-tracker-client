import { useEffect, useState, type RefObject } from 'react';
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
import { useIsMobile } from '@/hooks/media.hook';
import { PANE_SLIDE, PANE_SLIDE_TRANSITION, SWAP } from '@/lib/motion';
import useAdminStore, { type AdminDialogId } from '@/stores/admin.store';
import type { User } from '@/types/User';
import AlgemeenPane from './AlgemeenPane';
import BroadcastPane from './BroadcastPane';
import { IconPill } from './controls/Pill';
import HuntersPane from './HuntersPane';
import InvitesPane from './InvitesPane';
import KoppelingenPane from './KoppelingenPane';
import UsersPane from './UsersPane';
import { NavItem, type NavIcon } from './WindowNav';

interface BeheerDialogProps {
  /** For the Hunters pane's "Toon op kaart" */
  mapRef: RefObject<MapRef | null>;
}

const SECTIONS: { id: AdminDialogId; title: string; icon: NavIcon }[] = [
  { id: 'algemeen', title: 'Algemeen', icon: SlidersHorizontalIcon },
  { id: 'users', title: 'Gebruikers', icon: UsersIcon },
  { id: 'invites', title: 'Invites', icon: UserPlusIcon },
  { id: 'hunters', title: 'Hunters', icon: MapPinIcon },
  { id: 'broadcast', title: 'Bericht versturen', icon: MegaphoneIcon },
  { id: 'koppelingen', title: 'Koppelingen', icon: PlugIcon },
];

const titleOf = (id: AdminDialogId) => SECTIONS.find((section) => section.id === id)?.title ?? '';

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
      className="h-[640px] max-h-[85dvh] gap-0 overflow-hidden bg-beheer-window p-0 sm:max-w-[960px] sm:rounded-[20px]"
      drawerClassName="bg-beheer-window"
    >
      <BeheerWindow mapRef={mapRef} />
    </ResponsiveDialog>
  );
}

/** The window's content; only mounted while the window is open (or closing). */
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
  const hqTrailing = <ExternalLinkIcon className="ml-auto size-3.5 shrink-0" />;

  if (isMobile) {
    return (
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        {phoneView === 'list' ? (
          <motion.div
            key="list"
            className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto"
            custom={direction}
            variants={PANE_SLIDE}
            initial="enter"
            animate="center"
            exit="exit"
            transition={PANE_SLIDE_TRANSITION}
          >
            <div className="px-3 pt-1 pb-3 text-lg font-bold">Beheer</div>
            {SECTIONS.map(({ id, title, icon }) => (
              <NavItem key={id} icon={icon} title={title} onClick={() => select(id)} className="h-12 text-foreground" />
            ))}
            <NavItem icon={MonitorIcon} title="HQ-scherm" trailing={hqTrailing} onClick={openHq} className="mt-auto h-12 text-foreground" />
          </motion.div>
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
              <span className="text-lg font-bold">{titleOf(section)}</span>
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
    <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr] grid-rows-[minmax(0,1fr)]">
      <nav className="flex flex-col gap-0.5 px-3 py-[18px]" aria-label="Beheer">
        <div className="px-3 pt-0.5 pb-3.5 text-[17px] font-bold">Beheer</div>
        {SECTIONS.map(({ id, title, icon }) => (
          <NavItem key={id} icon={icon} title={title} active={id === section} indicatorId="beheer-nav-active" onClick={() => openDialog(id)} />
        ))}
        <NavItem icon={MonitorIcon} title="HQ-scherm" trailing={hqTrailing} onClick={openHq} className="mt-auto" />
      </nav>
      <div className="min-h-0 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={section} className="h-full overflow-y-auto px-7 py-6" {...SWAP}>
            {pane}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function SectionPane({ section, mapRef }: { section: AdminDialogId; mapRef: RefObject<MapRef | null> }) {
  switch (section) {
    case 'algemeen':
      return <AlgemeenPane />;
    case 'users':
      return <UsersPane />;
    case 'invites':
      return <InvitesPane />;
    case 'hunters':
      return <HuntersPane mapRef={mapRef} />;
    case 'broadcast':
      return <BroadcastPane />;
    case 'koppelingen':
      return <KoppelingenPane />;
  }
}
