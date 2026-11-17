import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SWAP } from '@/lib/motion';
import { BellIcon, ChevronRightIcon, CrosshairIcon, Grid3x3Icon, KeyRoundIcon, LayoutDashboardIcon, MapPinIcon, MessageSquareIcon, PawPrintIcon, PenLineIcon, SearchIcon, SmartphoneIcon, TrophyIcon, UsersIcon } from 'lucide-react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import type { User } from '@/types/User';
import SidebarHeader from '@/components/sidebar/SidebarHeader';
import { FoxesSummary } from '@/components/sidebar/foxes/FoxesCard';
import { useAppConfig } from '@/hooks/app-config.hook';
import { useHintBoard } from '@/hooks/hints.hook';
import { hintProgress } from '@/lib/hints';
import { useScore } from '@/hooks/score.hook';
import { scoreSummary } from '@/lib/score';
import { usePredictions, usePredictionSetting } from '@/hooks/predictions.hook';
import { predictionSummary } from '@/lib/prediction';
import { useTrackerStatus } from '@/hooks/tracker.hook';
import { trackerSummary } from '@/lib/tracker';
import { currentDevicePush } from '@/lib/push';
import { useHuntSync } from '@/hooks/hunt-sync.hook';
import { huntSyncSummary } from '@/lib/hunt-sync';
import { useTelegramMessages } from '@/hooks/telegram.hook';
import { telegramHeaderSummary } from '@/lib/bot-messages';
import { useCounterHunt } from '@/hooks/counter-hunt.hook';
import { counterHuntSummary } from '@/lib/counter-hunt';
import useMobileNavStore from '@/stores/mobile-nav.store';
import useAdminStore from '@/stores/admin.store';
import { BEHEER_SECTIONS } from '@/components/beheer/sections';
import { NOTIFICATION_ICON } from '@/components/notifications/notification-icons';
import useAccountDialogStore from '@/stores/account-dialog.store';
import useNotificationsDialogStore from '@/stores/notifications-dialog.store';
import type { MobilePageId } from '@/lib/mobile-nav';
import { menuRowTourTarget } from '@/components/tour/targets';

interface Row {
  key: string;
  icon: ReactNode;
  title: string;
  meta?: ReactNode;
  onSelect: () => void;
  /** Opens a dialog/drawer over the menu instead of pushing a page: no chevron, which promises a page push */
  dialog?: boolean;
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
            // MobileShell puts focus back on this row when the page it opened is popped
            data-nav-id={row.key}
            // The tour points at a section's row on phones
            {...menuRowTourTarget(row.key)}
            onClick={row.onSelect}
            className="flex min-h-14 items-center gap-3 rounded-(--radius-segment) bg-beheer-row px-3 py-2.5 text-left outline-none transition-colors first:rounded-t-2xl last:rounded-b-2xl focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset active:bg-beheer-row-high"
          >
            <span className="grid size-[18px] shrink-0 place-items-center text-muted-foreground">{row.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{row.title}</span>
              {/* The summaries come in with their polls: fade in instead of popping (the row keeps its 56px height) */}
              <AnimatePresence initial={false}>
                {row.meta && (
                  <motion.span key="meta" {...SWAP} className="block truncate text-xs text-muted-foreground">
                    {row.meta}
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
            {!row.dialog && <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />}
          </button>
        ))}
      </div>
    </section>
  );
}

/** The tegenhunt siren of its toast and Meldingen tile */
const CounterHuntIcon = NOTIFICATION_ICON['counter-hunt'];

/** Home of the phone sheet: header card + menu cards with live summaries. */
export default function MobileMenu({ onSearch }: { onSearch: () => void }) {
  const push = useMobileNavStore((s) => s.push);
  const { homeTeamApiId } = useAppConfig();
  const user = useAuthUser<User>();
  const { board } = useHintBoard();
  const progress = board ? hintProgress(board) : undefined;
  const { predictions } = usePredictions();
  const { enabled: predictionEnabled } = usePredictionSetting();
  const { status } = useTrackerStatus();
  const { score } = useScore();
  // The same summaries as the desktop sections' collapsed headers (SWR shares the polls with them)
  const { status: huntSync } = useHuntSync();
  const { messages, link } = useTelegramMessages();
  const { state: counterHunt, now } = useCounterHunt();
  const counterHuntMeta = counterHuntSummary(counterHunt, link, now);
  const page = (id: MobilePageId) => () => push({ id });
  // Read again when the Meldingen dialog closes (saving there can switch push on)
  useNotificationsDialogStore((s) => s.open);
  const devicePush = currentDevicePush();
  const pushMeta = devicePush !== 'on' && devicePush !== 'unsupported' ? 'Push uit op dit apparaat' : undefined;
  const icon = 'size-[18px]';

  const spel: Row[] = [
    { key: 'foxes', icon: <PawPrintIcon className={icon} />, title: 'Vossen', meta: <FoxesSummary />, onSelect: page('foxes') },
    // A hunter's main action: right under Vossen instead of at the end of the list
    { key: 'hintEntry', icon: <PenLineIcon className={icon} />, title: 'Hint registreren', onSelect: page('hintEntry') },
    { key: 'search', icon: <SearchIcon className={icon} />, title: 'Zoeken', meta: 'Coördinaat of groep', onSelect: onSearch, dialog: true },
    { key: 'hunts', icon: <CrosshairIcon className={icon} />, title: 'Hunts', meta: huntSyncSummary(huntSync), onSelect: page('hunts') },
    { key: 'telegram', icon: <MessageSquareIcon className={icon} />, title: 'Jotihunt-berichten', meta: telegramHeaderSummary(messages, link)?.text, onSelect: page('telegram') },
    ...(predictionEnabled !== false ? [{ key: 'predictions', icon: <MapPinIcon className={icon} />, title: 'Voorspelling', meta: predictionSummary(predictions), onSelect: page('predictions') }] : []),
    { key: 'hints', icon: <Grid3x3Icon className={icon} />, title: 'Hints', meta: progress ? `${progress.solved}/${progress.total} opgelost` : undefined, onSelect: page('hints') },
    ...(score?.configured ? [{ key: 'points', icon: <TrophyIcon className={icon} />, title: 'Punten', meta: scoreSummary(score), onSelect: page('points') }] : []),
    ...(homeTeamApiId !== null ? [{ key: 'counterHunt', icon: <CounterHuntIcon className={icon} />, title: 'Tegenhunt',
        // A running tegenhunt reads red (destructive-text, the app's red text: >= 5.3:1 on the row); the rest stays muted
        meta: counterHuntMeta && (counterHuntMeta.tone === 'danger' ? <span className="font-semibold text-destructive-text">{counterHuntMeta.text}</span> : counterHuntMeta.text),
        onSelect: page('counterHunt') }] : []),
  ];
  const jij: Row[] = [
    { key: 'tracking', icon: <SmartphoneIcon className={icon} />, title: 'Mijn tracker', meta: trackerSummary(status), onSelect: page('tracking') },
    // Admins only, like the desktop section (it links the team's account)
    ...(user?.admin ? [{ key: 'life360', icon: <UsersIcon className={icon} />, title: 'Life360', onSelect: page('life360') }] : []),
    ...(user?.admin ? [{ key: 'jotiboard', icon: <LayoutDashboardIcon className={icon} />, title: 'Jotiboard', onSelect: page('jotiboard') }] : []),
    { key: 'meldingen', icon: <BellIcon className={icon} />, title: 'Meldingen', meta: pushMeta, onSelect: () => useNotificationsDialogStore.getState().setOpen(true), dialog: true },
    { key: 'account', icon: <KeyRoundIcon className={icon} />, title: 'Account', onSelect: () => useAccountDialogStore.getState().setOpen(true), dialog: true },
  ];
  const beheer: Row[] = BEHEER_SECTIONS.map(({ id, title, icon: SectionIcon }) => ({ key: id, icon: <SectionIcon className={icon} />, title, onSelect: () => useAdminStore.getState().openDialog(id), dialog: true }));

  return (
    <div className="flex flex-col gap-3 pr-[max(0.75rem,env(safe-area-inset-right))] pb-8 pl-[max(0.75rem,env(safe-area-inset-left))]">
      <SidebarHeader className="rounded-3xl" />
      <MenuCard title="Spel" rows={spel} />
      <MenuCard title="Jij" rows={jij} />
      {user?.admin && <MenuCard title="Beheer" rows={beheer} />}
    </div>
  );
}
