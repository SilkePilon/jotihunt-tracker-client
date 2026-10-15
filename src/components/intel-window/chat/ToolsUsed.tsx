import { useState } from 'react';
import { motion } from 'motion/react';
import { CalculatorIcon, ChevronRightIcon, FileTextIcon, GlobeIcon, MapPinIcon, type LucideIcon } from 'lucide-react';
import Reveal from '@/components/motion/Reveal';
import { type ChatToolCall, stackedTools, toolDoneLabel, toolSummary, toolTone } from '@/lib/intel-chat';
import { SWAP_TRANSITION } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { ToolTone } from '@/types/IntelChat';

const TONE_CLASS: Record<ToolTone, string> = {
  app: 'bg-fox-warn-container text-fox-on-warn',
  map: 'bg-fox-ok-container text-fox-on-ok',
  web: 'bg-fox-cooldown-container text-fox-on-cooldown',
  think: 'bg-ai-think-container text-ai-on-think',
};
const TONE_ICON: Record<ToolTone, LucideIcon> = { app: FileTextIcon, map: MapPinIcon, web: GlobeIcon, think: CalculatorIcon };

/** Tonal square with the tool group's icon */
export function ToolIcon({ name, big = false, className }: { name: string; big?: boolean; className?: string }) {
  const tone = toolTone(name);
  const Icon = TONE_ICON[tone];
  return (
    <span aria-hidden className={cn('grid shrink-0 place-items-center', big ? 'size-6 rounded-lg [&_svg]:size-3.5' : 'size-4 rounded-md [&_svg]:size-2.5', TONE_CLASS[tone], className)}>
      <Icon />
    </span>
  );
}

/** After a turn: "N tools gebruikt ›" with up to 3 stacked icons; click unfolds a list (label + result line, red dot on errors) */
export default function ToolsUsed({ calls }: { calls: ChatToolCall[] }) {
  const [open, setOpen] = useState(false);
  const failed = calls.some((call) => call.state === 'error');
  return (
    <div className="flex flex-col items-start">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-[10px] bg-beheer-row px-2 py-1 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="flex pr-1">
          {stackedTools(calls).map((name) => (
            <ToolIcon key={name} name={name} className="-mr-1 ring-2 ring-beheer-row" />
          ))}
        </span>
        {calls.length} {calls.length === 1 ? 'tool' : 'tools'} gebruikt
        {failed && <span role="img" className="size-1.5 rounded-full bg-destructive" aria-label="met fouten" />}
        <motion.span className="grid" animate={{ rotate: open ? 90 : 0 }} transition={SWAP_TRANSITION}>
          <ChevronRightIcon className="size-3.5" />
        </motion.span>
      </button>
      <div className="w-full">
        <Reveal>
          {open && (
            <ul className="flex flex-col gap-0.5 pt-1.5">
              {calls.map((call) => {
                const summary = toolSummary(call);
                return (
                  <li key={call.id} className="flex min-w-0 items-center gap-2 rounded-xl bg-beheer-row px-2 py-1.5 text-[12px]">
                    <ToolIcon name={call.name} big />
                    <span className="shrink-0 font-semibold">{toolDoneLabel(call.name)}</span>
                    {summary && (
                      <span className={cn('flex min-w-0 items-center gap-1.5', call.state === 'error' ? 'text-destructive dark:text-red-300' : 'text-muted-foreground')}>
                        {call.state === 'error' && <span className="size-1.5 shrink-0 rounded-full bg-destructive" aria-hidden />}
                        <span className="truncate">{summary}</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Reveal>
      </div>
    </div>
  );
}
