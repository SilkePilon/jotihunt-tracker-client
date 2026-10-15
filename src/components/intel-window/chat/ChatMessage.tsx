import { type RefObject, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { FileUIPart, TextUIPart, UIMessage } from 'ai';
import ImageLightbox from '@/components/ImageLightbox';
import type { MapRef } from '@/components/Map';
import Reveal from '@/components/motion/Reveal';
import { type ChatPart, pointCards, reasoningText, thinkingPhase, toolCalls, webSources } from '@/lib/intel-chat';
import { POP } from '@/lib/motion';
import ChatMarkdown from './ChatMarkdown';
import PointCard from './PointCard';
import Reasoning from './Reasoning';
import SourceChips from './SourceChips';
import ToolsUsed from './ToolsUsed';

interface ChatMessageProps {
  message: UIMessage;
  /** This assistant message is the one streaming now */
  streaming: boolean;
  /** For "Toon op kaart" on point cards */
  mapRef: RefObject<MapRef | null>;
}

const isText = (part: ChatPart): part is TextUIPart => part.type === 'text';
const isImage = (part: ChatPart): part is FileUIPart => part.type === 'file' && part.mediaType.startsWith('image');

/**
 * User bubble on the right; an assistant message: its thinking, tools used (after the turn), markdown text, and once the
 * turn is done web sources and point cards (their tools run before the answer streams; they follow the text, not lead it)
 */
export default function ChatMessage({ message, streaming, mapRef }: ChatMessageProps) {
  const texts = message.parts.filter(isText).filter((part) => part.text.trim() !== '');
  if (message.role === 'user') return <UserMessage message={message} text={texts.map((part) => part.text).join('\n')} />;
  const cards = pointCards(message);
  const calls = toolCalls(message);
  const sources = webSources(message);
  const reasoning = reasoningText(message);
  return (
    <div className="mx-1 flex flex-col">
      <Reveal>
        {reasoning && (
          <div className="pb-2">
            <Reasoning text={reasoning} thinking={thinkingPhase(message, streaming)} />
          </div>
        )}
      </Reveal>
      {/* While it runs the status line shows the tools; the stack unfolds above the answer once the turn is done
          (outside the gap container, so folding in never jumps by a gap) */}
      <Reveal>
        {!streaming && calls.length > 0 && (
          <div className="pb-2">
            <ToolsUsed calls={calls} />
          </div>
        )}
      </Reveal>
      <div className="flex flex-col gap-2">
        {texts.map((part, index) => (
          <ChatMarkdown key={index} text={part.text} />
        ))}
        <Reveal gap={8}>{!streaming && sources.length > 0 && <SourceChips sources={sources} />}</Reveal>
        <AnimatePresence initial={false}>
          {(streaming ? [] : cards).map((card) => (
            <motion.div key={card.id} {...POP} style={{ originY: 0 }}>
              <PointCard point={card.point} proposal={card.proposal} mapRef={mapRef} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** The user's question (right), with its image above it (click: lightbox) */
function UserMessage({ message, text }: { message: UIMessage; text: string }) {
  const image = message.parts.find(isImage);
  const [zoom, setZoom] = useState(false);
  return (
    <div className="flex flex-col items-end gap-1.5">
      {image && (
        <>
          <button
            type="button"
            aria-label="Afbeelding vergroten"
            onClick={() => setZoom(true)}
            className="cursor-zoom-in overflow-hidden rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <img src={image.url} alt="" className="max-h-40 max-w-[220px] object-cover" />
          </button>
          <ImageLightbox src={image.url} alt="" open={zoom} onOpenChange={setZoom} />
        </>
      )}
      {text && <div className="max-w-[85%] rounded-[16px_16px_6px_16px] bg-beheer-row-high px-3 py-2 text-[13px] break-words whitespace-pre-wrap">{text}</div>}
    </div>
  );
}
