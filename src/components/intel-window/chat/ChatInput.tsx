import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { FileUIPart } from 'ai';
import { BrainIcon, GlobeIcon, Loader2Icon, PaperclipIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { prepareChatImage } from '@/lib/image';
import { CHAT_IMAGE_MAX_BYTES, CHAT_IMAGE_MAX_SIDE, CHAT_IMAGE_QUALITY, PLACEHOLDER, chatImageProblem, dataUrlBytes } from '@/lib/intel-chat';
import { POP, REVEAL_TRANSITION } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { IntelKind } from '@/types/Intel';
import { ModeToggle, PromptInput, PromptInputAction, PromptInputActions, PromptInputTextarea, SendButton } from './prompt-input';
import { useChatModes } from './useIntelChat';

interface ChatInputProps {
  kind: IntelKind;
  /** A turn is running: the send button stops it; typing goes on */
  busy: boolean;
  /** History not there yet (or failed): nothing can be sent */
  disabled: boolean;
  onSend: (text: string, image?: FileUIPart) => void;
  onStop: () => void;
}

type ChatImage = { status: 'loading' } | { status: 'ready'; url: string; name: string };

/** T1 prompt box: one image (paperclip, paste while focused, drop), textarea, Web and Denk diep (kept per user), send ↔ stop */
export default function ChatInput({ kind, busy, disabled, onSend, onStop }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [image, setImage] = useState<ChatImage | null>(null);
  const [dragging, setDragging] = useState(false);
  const [modes, setMode] = useChatModes();
  const fileInput = useRef<HTMLInputElement>(null);
  // A newer pick (or ✕) makes a resize that is still running irrelevant
  const attachId = useRef(0);
  const ready = !busy && !disabled && value.trim() !== '' && image?.status !== 'loading';

  async function attach(file: File) {
    const problem = chatImageProblem(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    const id = ++attachId.current;
    setImage({ status: 'loading' });
    try {
      const url = await prepareChatImage(file, CHAT_IMAGE_MAX_SIDE, CHAT_IMAGE_QUALITY);
      if (id !== attachId.current) return;
      if (dataUrlBytes(url) > CHAT_IMAGE_MAX_BYTES) {
        setImage(null);
        toast.error('Afbeelding is te groot, ook na verkleinen');
        return;
      }
      setImage({ status: 'ready', url, name: file.name || 'afbeelding.jpg' });
    } catch {
      if (id !== attachId.current) return;
      setImage(null);
      toast.error('Afbeelding lezen mislukt');
    }
  }

  function clearImage() {
    attachId.current++;
    setImage(null);
  }

  function submit() {
    if (!ready) return;
    const file: FileUIPart | undefined = image?.status === 'ready' ? { type: 'file', mediaType: 'image/jpeg', url: image.url, filename: image.name } : undefined;
    onSend(value.trim(), file);
    setValue('');
    clearImage();
  }

  return (
    <PromptInput
      value={value}
      onValueChange={setValue}
      onSubmit={submit}
      disabled={disabled}
      className={cn(dragging && 'ring-[3px] ring-ring/50')}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        const file = event.dataTransfer.files[0];
        setDragging(false);
        if (!file) return;
        event.preventDefault();
        if (!disabled) void attach(file);
      }}
    >
      <AnimatePresence initial={false}>
        {image && (
          <motion.div
            key="thumb"
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={REVEAL_TRANSITION}
          >
            <div className="px-1.5 pt-1.5 pb-1">
              <motion.div {...POP} className="relative size-14 overflow-hidden rounded-xl bg-beheer-row">
                <AnimatePresence mode="wait" initial={false}>
                  {image.status === 'ready' ? (
                    <motion.img key="image" src={image.url} alt="Bijlage" className="size-full object-cover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
                  ) : (
                    <motion.span key="loading" className="grid size-full place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Loader2Icon className="size-4 animate-spin text-muted-foreground" aria-label="Afbeelding verkleinen…" />
                    </motion.span>
                  )}
                </AnimatePresence>
                <button
                  type="button"
                  aria-label="Afbeelding weghalen"
                  onClick={clearImage}
                  className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-black/60 text-white outline-none focus-visible:ring-2 focus-visible:ring-white [&_svg]:size-3"
                >
                  <XIcon />
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <PromptInputTextarea
        placeholder={PLACEHOLDER[kind]}
        aria-label="Vraag aan de AI"
        maxLength={4000}
        // A draft (text or an attached image): Escape clears it, text first, instead of leaving the item (keepOpenWhileEditing)
        data-inline-edit={value || image ? '' : undefined}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || !(value || image)) return;
          event.stopPropagation();
          if (value) setValue('');
          else clearImage();
        }}
        // Only while the textarea has focus (no document-wide listener)
        onPaste={(event) => {
          const file = [...event.clipboardData.files].find((candidate) => candidate.type.startsWith('image/'));
          if (!file) return;
          event.preventDefault();
          void attach(file);
        }}
      />
      <PromptInputActions className="pt-0.5">
        <PromptInputAction tooltip="Afbeelding toevoegen">
          <button
            type="button"
            aria-label="Afbeelding toevoegen"
            disabled={disabled}
            onClick={() => fileInput.current?.click()}
            className="grid size-8 place-items-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4"
          >
            <PaperclipIcon />
          </button>
        </PromptInputAction>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void attach(file);
          }}
        />
        <ModeToggle tone="web" on={modes.web} onToggle={(on) => setMode('web', on)} icon={<GlobeIcon />} label="Web" tooltip="Web: mag op internet zoeken" />
        <span aria-hidden className="mx-0.5 h-4 w-px bg-foreground/10" />
        <ModeToggle tone="think" on={modes.deep} onToggle={(on) => setMode('deep', on)} icon={<BrainIcon />} label="Denk diep" tooltip="Denk diep: sterker model, duurt langer" />
        <SendButton state={busy ? 'busy' : ready ? 'ready' : 'idle'} onSend={submit} onStop={onStop} />
      </PromptInputActions>
    </PromptInput>
  );
}
