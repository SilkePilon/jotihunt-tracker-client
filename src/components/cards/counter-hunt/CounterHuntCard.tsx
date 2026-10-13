import { ArrowUpIcon } from 'lucide-react';
import CookieBadge from '@/components/tracker/CookieBadge';
import MaterialGlyph from '@/components/MaterialGlyph';
import { inlineLinkClass } from '@/components/tracker/styles';
import { counterHuntDirection, counterHuntLastText, counterHuntTitle, minutesLeft, type CounterHuntState } from '@/lib/counter-hunt';
import { formatClock } from '@/lib/format';

interface CounterHuntCardProps {
  /** undefined while loading */
  state: CounterHuntState | undefined;
  /** false when the server says Telegram is not linked (tegenhunts can't come in) */
  linked: boolean | undefined;
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
export default function CounterHuntCard({ state, linked, admin, now, onShowOnMap }: CounterHuntCardProps) {
  if (!state) return null;

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

  if (linked === false) {
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
