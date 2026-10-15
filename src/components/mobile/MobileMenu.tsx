import type { ReactNode } from 'react';
import { BellIcon, ChevronRightIcon, CrosshairIcon, FlagIcon, Grid3x3Icon, KeyRoundIcon, LayoutDashboardIcon, MapPinIcon, MessageSquareIcon, PawPrintIcon, PenLineIcon, ShieldIcon, SmartphoneIcon, UsersIcon } from 'lucide-react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import type { User } from '@/types/User';
import SidebarHeader from '@/components/sidebar/SidebarHeader';
import { FoxesSummary } from '@/components/sidebar/foxes/FoxesCard';
import { useHintBoard } from '@/hooks/hints.hook';
import { hintProgress } from '@/lib/hints';
import { usePredictions, usePredictionSetting } from '@/hooks/predictions.hook';
import { predictionSummary } from '@/lib/prediction';
import { useTrackerStatus } from '@/hooks/tracker.hook';
import { trackerSummary } from '@/lib/tracker';
import useMobileNavStore from '@/stores/mobile-nav.store';
import useAdminStore, { type AdminDialogId } from '@/stores/admin.store';
import useAccountDialogStore from '@/stores/account-dialog.store';
import useNotificationsDialogStore from '@/stores/notifications-dialog.store';
import type { MobilePageId } from '@/lib/mobile-nav';

interface Row {
  key: string;
  icon: ReactNode;
  title: string;
  meta?: ReactNode;
  onSelect: () => void;
}

/** Beheer D1 card with segmented rows (radii 16/6, 2px gaps). */
function MenuCard({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section className="rounded-3xl bg-card p-2">
      <h2 className="px-3 pb-2 pt-1.5 text-[15px] font-bold">{title}</h2>
      <div className="flex flex-col gap-0.5">
        {rows.map((row) => (
          <button
            key={row.key}
            type="button"
            onClick={row.onSelect}
            className="flex min-h-14 items-center gap-3 rounded-md bg-beheer-row px-3 py-2.5 text-left transition-colors first:rounded-t-2xl last:rounded-b-2xl active:bg-beheer-row-high"
          >
            <span className="grid size-[18px] shrink-0 place-items-center text-muted-foreground">{row.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{row.title}</span>
              {row.meta && <span className="block truncate text-xs text-muted-foreground">{row.meta}</span>}
            </span>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>
    </section>
  );
}

const BEHEER: [AdminDialogId, string][] = [
  ['algemeen', 'Algemeen'],
  ['users', 'Gebruikers'],
  ['invites', 'Invites'],
  ['hunters', 'Hunters'],
  ['broadcast', 'Bericht versturen'],
  ['koppelingen', 'Koppelingen'],
];

/** Home of the phone sheet: header card + menu cards with live summaries. */
export default function MobileMenu() {
  const push = useMobileNavStore((s) => s.push);
  const user = useAuthUser<User>();
  const { board } = useHintBoard();
  const progress = board ? hintProgress(board) : undefined;
  const { predictions } = usePredictions();
  const { enabled: predictionEnabled } = usePredictionSetting();
  const { status } = useTrackerStatus();
  const page = (id: MobilePageId) => () => push({ id });
  const icon = 'size-[18px]';

  const spel: Row[] = [
    { key: 'foxes', icon: <PawPrintIcon className={icon} />, title: 'Vossen', meta: <FoxesSummary />, onSelect: page('foxes') },
    { key: 'hunts', icon: <CrosshairIcon className={icon} />, title: 'Hunts', onSelect: page('hunts') },
    { key: 'telegram', icon: <MessageSquareIcon className={icon} />, title: 'Jotihunt-berichten', onSelect: page('telegram') },
    ...(predictionEnabled !== false ? [{ key: 'predictions', icon: <MapPinIcon className={icon} />, title: 'Voorspelling', meta: predictionSummary(predictions), onSelect: page('predictions') }] : []),
    { key: 'hints', icon: <Grid3x3Icon className={icon} />, title: 'Hints', meta: progress ? `${progress.solved}/${progress.total} opgelost` : undefined, onSelect: page('hints') },
    { key: 'hintEntry', icon: <PenLineIcon className={icon} />, title: 'Hint registreren', onSelect: page('hintEntry') },
    ...(import.meta.env.HOME_TEAM_API_ID ? [{ key: 'counterHunt', icon: <FlagIcon className={icon} />, title: 'Tegenhunt', onSelect: page('counterHunt') }] : []),
  ];
  const jij: Row[] = [
    { key: 'tracking', icon: <SmartphoneIcon className={icon} />, title: 'Mijn tracker', meta: trackerSummary(status), onSelect: page('tracking') },
    { key: 'life360', icon: <UsersIcon className={icon} />, title: 'Life360', onSelect: page('life360') },
    ...(user?.admin ? [{ key: 'jotiboard', icon: <LayoutDashboardIcon className={icon} />, title: 'Jotiboard', onSelect: page('jotiboard') }] : []),
    { key: 'meldingen', icon: <BellIcon className={icon} />, title: 'Meldingen', onSelect: () => useNotificationsDialogStore.getState().setOpen(true) },
    { key: 'account', icon: <KeyRoundIcon className={icon} />, title: 'Account', onSelect: () => useAccountDialogStore.getState().setOpen(true) },
  ];
  const beheer: Row[] = BEHEER.map(([id, title]) => ({ key: id, icon: <ShieldIcon className={icon} />, title, onSelect: () => useAdminStore.getState().openDialog(id) }));

  return (
    <div className="flex flex-col gap-3 px-3 pb-8">
      <SidebarHeader />
      <MenuCard title="Spel" rows={spel} />
      <MenuCard title="Jij" rows={jij} />
      {user?.admin && <MenuCard title="Beheer" rows={beheer} />}
    </div>
  );
}
