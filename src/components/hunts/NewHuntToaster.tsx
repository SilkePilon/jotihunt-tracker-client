import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { useHuntReports } from '@/hooks/hunt-reports.hook';
import { formatCountdown } from '@/lib/format';
import { huntTimeKnown, isQrHunt } from '@/lib/hunt-reports';
import { capitalizeFirstLetter } from '@/lib/utils';
import type { User } from '@/types/User';

/**
 * Toast every user when someone else registers a hunt: "Nieuwe hunt Alpha – nog 12:00 om in te sturen" (QR hunts:
 * "om te bevestigen").
 * The first load only records the known ids (no toasts for existing reports).
 */
export default function NewHuntToaster() {
  const user = useAuthUser<User>();
  const { reports } = useHuntReports();
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!reports) return;
    const ids = new Set(reports.map((report) => report._id));
    const prevKnown = known.current;
    const fresh = prevKnown ? reports.filter((report) => !prevKnown.has(report._id)) : [];
    known.current = ids;
    for (const report of fresh) {
      if (report.reportedBy === user?._id) continue;
      const left = new Date(report.deadline).getTime() - Date.now();
      toast.info(`Nieuwe hunt ${capitalizeFirstLetter(report.area)}`, {
        description:
          huntTimeKnown(report) && left > 0
            ? `Door ${report.reportedByName} – nog ${formatCountdown(left)} om ${isQrHunt(report) ? 'te bevestigen' : 'in te sturen'}.`
            : `Door ${report.reportedByName}.`,
      });
    }
  }, [reports, user?._id]);

  return null;
}
