import { memo } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

/** Links open in a new tab; raw HTML in the answer is never rendered (react-markdown default, no rehype-raw) */
const COMPONENTS: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  // Wide tables scroll sideways inside the bubble instead of stretching it
  table: ({ children }) => (
    <div className="my-1.5 overflow-x-auto rounded-xl bg-beheer-row-high">
      <table className="w-full border-collapse text-[12px]">{children}</table>
    </div>
  ),
};

/** GFM: tables, strikethrough, task lists, bare-URL autolinks */
const REMARK_PLUGINS = [remarkGfm];

/** An assistant answer as markdown in the chat's text look; `className` overrides it (the reasoning's small muted text) */
function ChatMarkdown({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={cn(
        'text-[13px] leading-[1.55] break-words [&_a]:text-primary [&_a]:underline [&_code]:rounded-md [&_code]:bg-beheer-row-high [&_code]:px-1 [&_code]:font-mono [&_code]:text-[12px] [&_h1]:my-2 [&_h1]:text-[15px] [&_h1]:font-bold [&_h2]:my-2 [&_h2]:text-[14px] [&_h2]:font-bold [&_h3]:my-1.5 [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-beheer-row-high [&_pre]:p-2.5 [&_del]:opacity-60 [&_strong]:font-semibold [&_td]:border-t [&_td]:border-border/60 [&_td]:px-2.5 [&_td]:py-1.5 [&_td]:align-top [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&>:first-child]:mt-0 [&>:last-child]:mb-0',
        className,
      )}
    >
      <Markdown components={COMPONENTS} remarkPlugins={REMARK_PLUGINS}>{text}</Markdown>
    </div>
  );
}

export default memo(ChatMarkdown);
