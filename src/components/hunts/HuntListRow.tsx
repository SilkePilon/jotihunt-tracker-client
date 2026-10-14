import { memo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { BeheerExpandableRow, BeheerRow, InlineConfirm } from '@/components/beheer/BeheerLayout';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { HUNT_ROW_TONE_CLASS, huntRowFlag, huntRowStatus, websiteHuntStatus, type HuntRowStatus } from '@/lib/hunt-list';
import { formatHuntTimeSafe, hasLiveCountdown, huntTimeLabel } from '@/lib/hunt-reports';
import { capitalizeFirstLetter, cn } from '@/lib/utils';
import type { Hunt } from '@/types/Hunt';
import type { HuntListItem, HuntReport } from '@/types/HuntReport';
import HuntCodeText from './HuntCodeText';
import HuntMarkerIcon from './HuntMarkerIcon';
import HuntRowDetails from './HuntRowDetails';

/** Coloured status at the start of the meta line; fades over when the status changes, pulses in the last 5 minutes. */
function StatusText({ status }: { status: HuntRowStatus }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={status.tone}
        className={cn('font-semibold', HUNT_ROW_TONE_CLASS[status.tone], status.urgent && 'motion-safe:animate-pulse')}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {status.text}
      </motion.span>
    </AnimatePresence>
  );
}

/** "Te versturen · 8:42 · Alpha · 14:05 · Merida · controleren", with its own clock: only rows with a running countdown tick. */
function ReportMeta({ report }: { report: HuntReport }) {
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), hasLiveCountdown(report, now) ? 1000 : null);
  const status = huntRowStatus(report, now);
  const flag = huntRowFlag(report);
  return (
    <span className="block truncate">
      {status && (
        <>
          <StatusText status={status} />
          {' · '}
        </>
      )}
      {capitalizeFirstLetter(report.area)} · {huntTimeLabel(report)} · {report.reportedByName}
      {flag && <span className="text-amber-700 dark:text-amber-300"> · {flag}</span>}
    </span>
  );
}

function Points({ points }: { points: number }) {
  return <span className={cn('text-sm font-bold tabular-nums', points > 0 ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground')}>{points} pt</span>;
}

function ReportRow({ report }: { report: HuntReport }) {
  const { deleteReport } = useHuntReports();
  const [confirming, setConfirming] = useState(false);
  const codeLabel = report.huntCode ?? 'zonder code';

  async function remove() {
    try {
      await deleteReport(report._id);
      toast.success('Hunt verwijderd');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Verwijderen is mislukt'));
      setConfirming(false);
    }
  }

  return (
    <BeheerExpandableRow
      id={report._id}
      leading={<HuntMarkerIcon area={report.area} />}
      title={<HuntCodeText report={report} />}
      meta={<ReportMeta report={report} />}
      trailing={report.status === 'judged' && report.site ? <Points points={report.site.points} /> : undefined}
      bodyClassName="flex flex-col px-3 pt-1 pb-3"
      confirm={
        confirming ? (
          <InlineConfirm
            title={`Hunt ${codeLabel} verwijderen?`}
            description="De foto wordt ook verwijderd."
            confirmLabel="Verwijderen"
            confirmIcon={<Trash2Icon />}
            onCancel={() => setConfirming(false)}
            onConfirm={remove}
          />
        ) : undefined
      }
    >
      <HuntRowDetails report={report} onDelete={() => setConfirming(true)} />
    </BeheerExpandableRow>
  );
}

/** A jotihunt.nl hunt nobody registered in the app: no photo or actions, so the row doesn't open. */
function WebsiteRow({ hunt }: { hunt: Hunt }) {
  return (
    <BeheerRow
      leading={<HuntMarkerIcon area={hunt.area} website />}
      title={<span className="truncate font-mono font-bold">{hunt.huntCode}</span>}
      meta={
        <span className="block truncate">
          <StatusText status={websiteHuntStatus(hunt)} /> · {capitalizeFirstLetter(hunt.area.trim())} · {formatHuntTimeSafe(hunt.huntTime)} · jotihunt.nl
        </span>
      }
    >
      <Points points={hunt.points} />
    </BeheerRow>
  );
}

/** One row of "Alle hunts": the hunt marker, code, status + area · time · reporter; own reports open to photo, facts and actions. */
const HuntListRow = memo(function HuntListRow({ item }: { item: HuntListItem }) {
  return item.source === 'website' ? <WebsiteRow hunt={item.hunt} /> : <ReportRow report={item.report} />;
});

export default HuntListRow;
