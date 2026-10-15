import type { RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { TextUIPart, UIMessage } from 'ai';
import type { MapRef } from '@/components/Map';
import { type ChatPart, pointCards } from '@/lib/intel-chat';
import { POP } from '@/lib/motion';
import ChatMarkdown from './ChatMarkdown';
import PointCard from './PointCard';

interface ChatMessageProps {
  message: UIMessage;
  /** This assistant message is the one streaming now */
  streaming: boolean;
  /** For "Toon op kaart" on point cards */
  mapRef: RefObject<MapRef | null>;
}

const isText = (part: ChatPart): part is TextUIPart => part.type === 'text';

/** User bubble on the right; an assistant message as markdown text, then its point cards (popping in) */
export default function ChatMessage({ message, mapRef }: ChatMessageProps) {
  const texts = message.parts.filter(isText).filter((part) => part.text.trim() !== '');
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[16px_16px_6px_16px] bg-beheer-row-high px-3 py-2 text-[13px] break-words whitespace-pre-wrap">{texts.map((part) => part.text).join('\n')}</div>
      </div>
    );
  }
  const cards = pointCards(message);
  return (
    <div className="mx-1 flex flex-col gap-2">
      {texts.map((part, index) => (
        <ChatMarkdown key={index} text={part.text} />
      ))}
      <AnimatePresence initial={false}>
        {cards.map((card) => (
          <motion.div key={card.id} {...POP} style={{ originY: 0 }}>
            <PointCard point={card.point} proposal={card.proposal} mapRef={mapRef} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
