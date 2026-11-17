import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpIcon, TriangleAlertIcon } from 'lucide-react';
import LoadError from '@/components/LoadError';
import Reveal from '@/components/motion/Reveal';
import { Skeleton } from '@/components/ui/skeleton';
import CookieBadge from '@/components/tracker/CookieBadge';
import MaterialGlyph from '@/components/MaterialGlyph';
import { inlineLinkClass } from '@/components/tracker/styles';
import { counterHuntDirection, counterHuntLastText, counterHuntTitle, minutesLeft, type CounterHuntState } from '@/lib/counter-hunt';
import { formatClock } from '@/lib/format';
import { SWAP } from '@/lib/motion';
import type { TelegramLink } from '@/lib/telegram';

interface CounterHuntCardProps {
  /** undefined while loading (or when the first load failed) */
  state: CounterHuntState | undefined;
  /** The last fetch failed: a retry without data, a stale warning under older data */
  isError?: boolean;
  onRetry: () => Promise<unknown> | unknown;
  /** Whether tegenhunts can come in: Telegram not linked or not connected shows a warning; undefined = unknown */
  link: TelegramLink | undefined;
  /** Admins get the hint where to link Telegram */
  admin?: boolean;
  now: number;
  /** Fly to the wind sector; only offered when the direction is known */
  onShowOnMap?: () => void;
}

/**
 * The "Tegenhunt" card, fully automatic: the server starts a tegenhunt from the @Jotihunt_bot message, this card shows
 * it (direction, minutes left) for 30 minutes and then goes back to quiet.
 */
export default function CounterHuntCard({ state, isError, onRetry, link, admin, now, onShowOnMap }: CounterHuntCardProps) {
  const view = !state ? (isError ? 'error' : 'loading') : state.kind === 'active' ? 'active' : link === 'disconnected' || link === 'unlinked' ? link : 'quiet';
  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={view} {...SWAP}>
          {!state ? (
            isError ? (
              <LoadError centered message="Tegenhunt-status kon niet worden geladen." onRetry={onRetry} />
            ) : (
              <div className="flex flex-col items-center gap-2.5" role="status" aria-label="Tegenhunt laden">
                <Skeleton className="size-12 rounded-full" />
                <div className="flex w-full flex-col items-center gap-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-48 max-w-full" />
                </div>
              </div>
            )
          ) : (
            <CounterHuntBody state={state} link={link} admin={admin} now={now} onShowOnMap={onShowOnMap} />
          )}
        </motion.div>
      </AnimatePresence>
      {/* A later poll failed: the last known state stays, with a note that it may be outdated */}
      <Reveal>
        {state && isError && (
          <p className="flex items-center justify-center gap-1.5 pt-2.5 text-center text-xs text-muted-foreground">
            <TriangleAlertIcon className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            Niet bijgewerkt: verbinding met de server mislukt
          </p>
        )}
      </Reveal>
    </>
  );
}

function CounterHuntBody({ state, link, admin, now, onShowOnMap }: Omit<CounterHuntCardProps, 'state' | 'isError' | 'onRetry'> & { state: CounterHuntState }) {
  if (state.kind === 'active') {
    const direction = counterHuntDirection(state.direction);
    return (
      <div className="flex flex-col items-center gap-2.5 text-center" data-counter-hunt="active">
        <CookieBadge
          tone="danger"
          size={64}
          glyph={direction ? <ArrowUpIcon className="size-8" strokeWidth={3} style={{ transform: `rotate(${direction.degrees}deg)` }} /> : '?'}
        />
        <div className="flex w-full flex-col gap-0.5">
          <span className="text-base font-semibold">{counterHuntTitle(state.direction)}</span>
          {direction ? (
            <>
              <span className="text-xs text-muted-foreground">
                Gestart {formatClock(state.startedAt)} · <b className="text-red-600 dark:text-red-400">nog {minutesLeft(state.endsAt, now)} min</b>
              </span>
              <span className="mt-0.5 text-xs text-muted-foreground">
                Zoek de sticker binnen 500 m
                {onShowOnMap && (
                  <>
                    {' · '}
                    <button type="button" className={inlineLinkClass} onClick={onShowOnMap}>
                      toon op kaart
                    </button>
                  </>
                )}
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Richting niet herkend; lees het bericht:</span>
          )}
        </div>
        {!direction && state.text && (
          <blockquote className="w-full rounded-lg bg-black/5 p-2 text-left text-xs whitespace-pre-line break-words dark:bg-black/20">{state.text}</blockquote>
        )}
      </div>
    );
  }

  if (link === 'disconnected') {
    return (
      <div className="flex flex-col items-center gap-2.5 text-center" data-counter-hunt="disconnected">
        <CookieBadge tone="warn" size={48} />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">Geen verbinding met Telegram</span>
          <span className="text-xs text-muted-foreground">Tegenhunts komen nu niet binnen. De server probeert opnieuw te verbinden.</span>
        </div>
      </div>
    );
  }

  if (link === 'unlinked') {
    return (
      <div className="flex flex-col items-center gap-2.5 text-center" data-counter-hunt="not-linked">
        <CookieBadge tone="warn" size={48} />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">Tegenhunts komen niet binnen</span>
          <span className="text-xs text-muted-foreground">
            {admin ? 'Telegram is niet gekoppeld. Koppelen kan in de kaart Jotihunt-berichten (admins).' : 'Telegram is niet gekoppeld.'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2.5 text-center" data-counter-hunt="quiet">
      <CookieBadge tone="neutral" size={48} glyph={<MaterialGlyph name="home" size={24} />} />
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">Geen tegenhunt</span>
        <span className="text-xs text-muted-foreground">
          {state.last ? counterHuntLastText(state.last) : 'Komt er een, dan zie je hem hier en op de kaart, en krijgt iedereen een melding.'}
        </span>
      </div>
    </div>
  );
}
