import { useState } from 'react';
import MaterialGlyph from '@/components/MaterialGlyph';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useHappyHour } from '@/hooks/happy-hour.hook';
import useInterval from '@/hooks/utils/interval.hook';
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
  const [now, setNow] = useState(() => Date.now());
  // The countdown is in minutes; ticking every 5 s keeps the start and end switch close to on time
  useInterval(() => setNow(Date.now()), view && view.state !== 'none' ? 5000 : null);
  const hour = happyHourWindow(view, now);
  return hour ? <HappyHourPillView hour={hour} now={now} /> : null;
}
