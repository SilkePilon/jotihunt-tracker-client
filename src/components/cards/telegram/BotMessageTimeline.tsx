import { useMarkerPalette } from '@/components/layers/marker-icons';
import { botMessageStyle } from '@/lib/bot-messages';
import { formatClock } from '@/lib/format';
import type { BotMessage } from '@/types/Telegram';
import BotMessageMarker from './BotMessageMarker';

/**
 * The @Jotihunt_bot messages, newest first: marker, label, time and the full text. The line between two markers
 * leaves 6 px free above and below (it never runs under a marker).
 */
export default function BotMessageTimeline({ messages }: { messages: BotMessage[] }) {
  const palette = useMarkerPalette();
  return (
    <ol className="flex flex-col">
      {messages.map((message, index) => (
        <li key={message.id} className="relative flex gap-2.5 pb-3 last:pb-0">
          {index < messages.length - 1 && <span aria-hidden className="absolute top-[38px] bottom-1.5 left-[15px] w-0.5 rounded-full bg-border" />}
          <BotMessageMarker kind={message.kind} palette={palette} />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold">{botMessageStyle(message.kind).label}</span>
              <time dateTime={message.receivedAt} className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                {formatClock(message.receivedAt)}
              </time>
            </div>
            <p className="text-[13px] leading-snug whitespace-pre-line break-words text-muted-foreground">{message.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
