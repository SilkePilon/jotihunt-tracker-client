import { useEffect, useRef, useState, type RefObject } from 'react';
import { motion } from 'motion/react';
import { Building2Icon, DownloadIcon, Loader2Icon, RefreshCwIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import type { MapRef } from '@/components/Map';
import Reveal from '@/components/motion/Reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { useBuildingsAdmin } from '@/hooks/buildings.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { formatMegabytes, jobLine, jobRunning, PREFETCH_RADII } from '@/lib/buildings';
import { EASE_OUT } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { BeheerCard, FadeSwap, InlineConfirm } from './BeheerLayout';
import { Pill } from './controls/Pill';

/** The inline confirm sits in the card as a red box (as in KoppelingenPane) */
const CONFIRM_BOX = 'rounded-[18px] bg-destructive/12 px-3.5 py-3';
const dateFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });

type Action = 'refresh' | 'prefetch' | 'clear';

/** Beheer → Koppelingen: the 3DBAG building cache — stats, job progress, refresh / prefetch around the map centre / clear. */
export default function BuildingsCard({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const { status, isError, refresh, prefetch, clear } = useBuildingsAdmin();
  const [radiusKm, setRadiusKm] = useState<number>(PREFETCH_RADII[1]);
  const [confirming, setConfirming] = useState(false);
  // The action whose request is on its way (the job itself shows through the polled status)
  const [starting, setStarting] = useState<Action | null>(null);
  const running = jobRunning(status);
  const busy = running || starting !== null;
  const spinning = (kind: 'refresh' | 'prefetch') => starting === kind || (running && status?.job?.kind === kind);

  // A job that vanishes while running means the server restarted mid-job
  const wasRunning = useRef(running);
  useEffect(() => {
    if (wasRunning.current && status && !status.job) toast.warning('De taak is onderbroken (server herstart). Start hem opnieuw.');
    wasRunning.current = running;
  }, [running, status]);

  async function run(action: Action, call: () => Promise<unknown>, fallback: string) {
    setStarting(action);
    try {
      await call();
    } catch (error) {
      toast.error(apiErrorMessage(error, fallback));
    } finally {
      setStarting(null);
    }
  }

  function prefetchAroundCentre() {
    const centre = mapRef.current?.getCenter();
    if (!centre) {
      toast.error('Kaart is nog niet geladen.');
      return;
    }
    void run('prefetch', () => prefetch(centre.lat, centre.lng, radiusKm), 'Vooraf laden starten is mislukt.');
  }

  async function clearCache() {
    await run('clear', clear, 'Cache wissen is mislukt.');
    setConfirming(false);
  }

  const summary = status
    ? `${status.tiles.toLocaleString('nl-NL')} tegels · ${status.buildings.toLocaleString('nl-NL')} gebouwdelen · ${formatMegabytes(status.bytes)}`
    : null;
  const dates =
    status?.oldest && status.newest ? `Data van ${dateFormat.format(new Date(status.oldest))} – ${dateFormat.format(new Date(status.newest))}` : 'Nog niets geladen';
  const job = status?.job;
  const progress = job?.total ? job.done / job.total : running ? 0 : 1;

  return (
    <BeheerCard>
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Building2Icon className="size-[22px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold">3D-gebouwen</h3>
          <FadeSwap className="text-[12.5px] text-muted-foreground">{summary ?? (isError ? 'Status ophalen is mislukt.' : <Skeleton className="mt-1 h-3 w-40" />)}</FadeSwap>
          <Reveal>{status && <FadeSwap className="text-xs text-muted-foreground">{dates}</FadeSwap>}</Reveal>
        </div>
      </div>

      <Reveal>
        {job && (
          // Lined up with the text (44px icon + 12px gap)
          <div className="pt-3 pl-14">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={false}
                animate={{ width: `${Math.round(progress * 100)}%` }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
              />
            </div>
            <FadeSwap className="pt-1 text-xs tabular-nums text-muted-foreground">{jobLine(job)}</FadeSwap>
          </div>
        )}
      </Reveal>

      <div className="flex flex-wrap items-center gap-2 pt-3 pl-14">
        <Pill
          variant="primary"
          morphKey={spinning('refresh') ? 'busy' : 'idle'}
          disabled={busy || !status?.tiles}
          onClick={() => void run('refresh', refresh, 'Vernieuwen starten is mislukt.')}
        >
          {spinning('refresh') ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
          Vernieuwen
        </Pill>
        <Pill variant="secondary" morphKey={spinning('prefetch') ? 'busy' : 'idle'} disabled={busy || !status} onClick={prefetchAroundCentre}>
          {spinning('prefetch') ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
          Vooraf laden
        </Pill>
        <div className="flex gap-1" role="radiogroup" aria-label="Straal">
          {PREFETCH_RADII.map((radius) => (
            // Selectable chips as in HuntableAreasCard
            <button
              key={radius}
              type="button"
              role="radio"
              aria-checked={radius === radiusKm}
              disabled={busy}
              onClick={() => setRadiusKm(radius)}
              className={cn(
                'inline-flex h-8 items-center rounded-lg px-3 text-[12.5px] font-semibold tabular-nums outline-none transition-[background-color,color,transform] duration-200 focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.97] disabled:opacity-50 motion-reduce:transition-none',
                radius === radiusKm ? 'bg-foreground/12 text-foreground' : 'bg-beheer-row text-muted-foreground',
              )}
            >
              {radius} km
            </button>
          ))}
        </div>
        <Pill variant="danger-outline" disabled={busy || confirming || !status?.tiles} onClick={() => setConfirming(true)}>
          <Trash2Icon />
          Cache wissen
        </Pill>
      </div>

      <Reveal>
        {confirming && (
          <div className="pt-3">
            <InlineConfirm
              className={CONFIRM_BOX}
              title="3D-cache wissen?"
              description="Alle opgeslagen gebouwen worden verwijderd. Ze worden opnieuw van 3DBAG gehaald zodra iemand er naar kijkt."
              confirmLabel="Wis cache"
              confirmIcon={<Trash2Icon />}
              onCancel={() => setConfirming(false)}
              onConfirm={clearCache}
            />
          </div>
        )}
      </Reveal>
    </BeheerCard>
  );
}
