import MaterialGlyph from '@/components/MaterialGlyph';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useHappyHour } from '@/hooks/happy-hour.hook';
import { useNow } from '@/hooks/now.hook';
import { happyHourExplanation, happyHourPill, happyHourPillText, happyHourWindow, type HappyHourWindow } from '@/lib/happy-hour';

/** Amber pill (flat): "Happy hour · 2× punten · nog 34 min"; tap for the explanation and the bot's message. */
export function HappyHourPillView({ hour, now }: { hour: HappyHourWindow; now: number }) {
  const { title, countdown } = happyHourPill(hour, now);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={happyHourPillText(hour, now)}
          className="pointer-events-auto flex cursor-pointer items-center gap-2 rounded-full bg-[#f59e0b] py-1.5 pr-3.5 pl-2.5 text-[13px] font-bold whitespace-nowrap text-[#1c1300] outline-none focus-visible:ring-2 focus-visible:ring-[#1c1300]/40"
          data-happy-hour={hour.state}
        >
          <MaterialGlyph name="celebration" size={18} />
          {title}
          <span className="font-medium opacity-80">{countdown}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="flex w-72 flex-col gap-2 text-sm">
        <p>{happyHourExplanation(hour)}</p>
        {hour.text && <blockquote className="rounded-md bg-muted p-2 text-xs whitespace-pre-line break-words text-muted-foreground">{hour.text}</blockquote>}
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
