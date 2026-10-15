import { useState } from 'react';
import { BrainIcon, GlobeIcon } from 'lucide-react';
import { PLACEHOLDER } from '@/lib/intel-chat';
import type { IntelKind } from '@/types/Intel';
import { ModeToggle, PromptInput, PromptInputActions, PromptInputTextarea, SendButton } from './prompt-input';
import { useChatModes } from './useIntelChat';

interface ChatInputProps {
  kind: IntelKind;
  /** A turn is running: the send button stops it; typing goes on */
  busy: boolean;
  /** History not there yet (or failed): nothing can be sent */
  disabled: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

/** T1 prompt box: textarea, Web and Denk diep (kept per user), send ↔ stop */
export default function ChatInput({ kind, busy, disabled, onSend, onStop }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [modes, setMode] = useChatModes();
  const ready = !busy && !disabled && value.trim() !== '';

  function submit() {
    if (!ready) return;
    onSend(value.trim());
    setValue('');
  }

  return (
    <PromptInput value={value} onValueChange={setValue} onSubmit={submit} disabled={disabled}>
      <PromptInputTextarea
        placeholder={PLACEHOLDER[kind]}
        aria-label="Vraag aan de AI"
        maxLength={4000}
        // A draft: Escape clears it instead of leaving the item (keepOpenWhileEditing)
        data-inline-edit={value ? '' : undefined}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.stopPropagation();
            setValue('');
          }
        }}
      />
      <PromptInputActions className="pt-0.5">
        <ModeToggle tone="web" on={modes.web} onToggle={(on) => setMode('web', on)} icon={<GlobeIcon />} label="Web" tooltip="Web: mag op internet zoeken" />
        <span aria-hidden className="mx-0.5 h-4 w-px bg-foreground/10" />
        <ModeToggle tone="think" on={modes.deep} onToggle={(on) => setMode('deep', on)} icon={<BrainIcon />} label="Denk diep" tooltip="Denk diep: sterker model, duurt langer" />
        <SendButton state={busy ? 'busy' : ready ? 'ready' : 'idle'} onSend={submit} onStop={onStop} />
      </PromptInputActions>
    </PromptInput>
  );
}
