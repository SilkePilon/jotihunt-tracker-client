import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDownIcon, ChevronRightIcon, GlobeIcon } from 'lucide-react';
import Reveal from '@/components/motion/Reveal';
import { type ChatSource, groupSources, type SourceGroup } from '@/lib/intel-chat';
import { SWAP_TRANSITION } from '@/lib/motion';
import { cn } from '@/lib/utils';

/** Favicons in the closed button */
const STACK = 4;

/** A site's favicon (Google's favicon service), a globe when it doesn't load */
function Favicon({ site, className }: { site: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <GlobeIcon className={cn('size-4 shrink-0 text-muted-foreground', className)} aria-hidden />;
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(site)}&sz=32`}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('size-4 shrink-0 rounded-[4px] bg-white', className)}
    />
  );
}

/**
 * Web sources of the answer: one compact button with the sites' favicons stacked and "11 bronnen"; it unfolds into a
 * list per site (favicon, site, count). A site with one source links straight to it; one with more unfolds its links.
 */
export default function Sources({ sources }: { sources: ChatSource[] }) {
  const groups = useMemo(() => groupSources(sources), [sources]);
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-start">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex h-8 cursor-pointer items-center gap-2 rounded-xl bg-beheer-row pr-2 pl-2 text-[12px] font-semibold outline-none transition-colors hover:bg-beheer-row-high focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="flex">
          {groups.slice(0, STACK).map((group, index) => (
            <Favicon key={group.site} site={group.site} className={cn('ring-2 ring-beheer-row', index > 0 && '-ml-1.5')} />
          ))}
        </span>
        {sources.length === 1 ? '1 bron' : `${sources.length} bronnen`}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={SWAP_TRANSITION} className="grid text-muted-foreground">
          <ChevronDownIcon className="size-3.5" />
        </motion.span>
      </button>
      <div className="w-full">
        <Reveal gap={6}>
          {open && (
            <div className="overflow-hidden rounded-2xl bg-beheer-row">
              {groups.map((group) => (
                <SiteRow key={group.site} group={group} />
              ))}
            </div>
          )}
        </Reveal>
      </div>
    </div>
  );
}

const ROW = 'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] font-semibold outline-none transition-colors hover:bg-beheer-row-high focus-visible:bg-beheer-row-high';

/** One site; rows are split by the card colour (as the Account dialog's rows) */
function SiteRow({ group }: { group: SourceGroup }) {
  const [open, setOpen] = useState(false);
  const count = group.sources.length;
  const label = (
    <>
      <Favicon site={group.site} />
      <span className="min-w-0 flex-1 truncate">{group.site}</span>
      {count > 1 && <span className="rounded-md bg-beheer-row-high px-1.5 text-[10.5px] font-bold text-muted-foreground tabular-nums">{count}</span>}
    </>
  );
  return (
    <div className="border-t-2 border-card first:border-t-0">
      {count === 1 ? (
        <a href={group.sources[0].url} target="_blank" rel="noopener noreferrer" title={group.sources[0].title} className={ROW}>
          {label}
          <ChevronRightIcon className="size-3.5 text-muted-foreground" aria-hidden />
        </a>
      ) : (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={cn(ROW, 'cursor-pointer')}>
          {label}
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={SWAP_TRANSITION} className="grid text-muted-foreground">
            <ChevronDownIcon className="size-3.5" />
          </motion.span>
        </button>
      )}
      <Reveal>
        {open && (
          <div className="flex flex-col pb-1.5">
            {group.sources.map((source, index) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate py-1 pr-3 pl-[38px] text-[12px] text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground focus-visible:underline"
              >
                {source.title.toLowerCase() === group.site ? `Bron ${index + 1}` : source.title}
              </a>
            ))}
          </div>
        )}
      </Reveal>
    </div>
  );
}
