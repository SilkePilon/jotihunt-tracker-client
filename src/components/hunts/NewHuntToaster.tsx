import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { formatHintCountdown } from '@/lib/next-hint';
import { capitalizeFirstLetter } from '@/lib/utils';
import type { User } from '@/types/User';

/**
 * Toast every user when someone else registers a hunt: "Nieuwe hunt Alpha – nog 27:00 om in te sturen".
 * The first load only records the known ids (no toasts for existing reports).
 */
export default function NewHuntToaster() {
  const user = useAuthUser<User>();
  const { reports } = useHuntReports();
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!reports) return;
    const ids = new Set(reports.map((report) => report._id));
    const fresh = known.current ? reports.filter((report) => !known.current!.has(report._id)) : [];
    known.current = ids;
    for (const report of fresh) {
      if (report.reportedBy === user?._id) continue;
      const left = new Date(report.deadline).getTime() - Date.now();
      toast.info(`Nieuwe ${report.kind === 'tegenhunt' ? 'tegenhunt' : 'hunt'} ${capitalizeFirstLetter(report.area)}`, {
        description: left > 0 ? `Door ${report.reportedByName} – nog ${formatHintCountdown(left)} om in te sturen.` : `Door ${report.reportedByName}.`,
      });
    }
  }, [reports, user?._id]);

  return null;
}
