import MaterialGlyph from '@/components/MaterialGlyph';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useHappyHour } from '@/hooks/happy-hour.hook';
import { useNow } from '@/hooks/now.hook';
import { happyHourExplanation, happyHourPill, happyHourPillText, happyHourWindow, type HappyHourWindow } from '@/lib/happy-hour';

/**
 * Amber pill (flat): "Happy hour · 2× punten · nog 34 min"; tap for the explanation and the bot's message. The amber is
 * happy hour's own colour (also its toast and notification tile), deliberately not a fox status token.
 */
function HappyHourPillView({ hour, now }: { hour: HappyHourWindow; now: number }) {
  const { title, countdown } = happyHourPill(hour, now);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={happyHourPillText(hour, now)}
          className="pointer-events-auto flex cursor-pointer items-center gap-2 rounded-full bg-happy-hour py-1.5 pr-3.5 pl-2.5 text-[13px] font-bold whitespace-nowrap text-on-happy-hour outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
          data-happy-hour={hour.state}
        >
          <MaterialGlyph name="celebration" size={18} />
          {title}
          <span className="font-medium tabular-nums opacity-80">{countdown}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="flex w-72 flex-col gap-2 text-sm">
        <p>{happyHourExplanation(hour)}</p>
        {hour.text && <blockquote className="rounded-xl bg-beheer-row p-2 text-xs whitespace-pre-line break-words text-muted-foreground">{hour.text}</blockquote>}
      </PopoverContent>
    </Popover>
  );
}

/** The happy-hour pill from the server's /happy-hour; nothing when there is none. */
export default function HappyHourPill() {
  const { view } = useHappyHour();
  // Ticks while there is a happy hour; a new or changed one renders with the current time right away
  const now = useNow(!!view && view.state !== 'none');
  const hour = happyHourWindow(view, now);
  return hour ? <HappyHourPillView hour={hour} now={now} /> : null;
}
