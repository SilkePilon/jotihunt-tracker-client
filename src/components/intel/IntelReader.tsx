import { memo, useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import ImageLightbox from '@/components/ImageLightbox';
import HintContent from '@/components/hints/detail/HintContent';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatClock } from '@/lib/format';
import { capitalizeFirstLetter, cn, getColorFromArea } from '@/lib/utils';
import type { IntelItem, IntelType } from '@/types/Intel';

const TYPE_STYLE: Record<IntelType, { label: string; text: string; border: string }> = {
  hint: { label: 'Hint', text: 'text-primary', border: 'border-primary/40' },
  assignment: { label: 'Opdracht', text: 'text-blue-600 dark:text-blue-300', border: 'border-blue-500/40' },
  news: { label: 'Nieuws', text: 'text-violet-600 dark:text-violet-300', border: 'border-violet-500/40' },
};

const LABEL = 'text-[11px] font-semibold uppercase tracking-wider';
const CONTENT = 'bg-card text-base [&_img]:mx-auto';

/** The automatic summary of a news item or assignment, and what it means for us */
function Summary({ item }: { item: IntelItem }) {
  return (
    <section className={cn('flex flex-col gap-2 rounded-xl border bg-card p-4', TYPE_STYLE[item.type].border)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={cn(LABEL, TYPE_STYLE[item.type].text)}>Samenvatting</h2>
        <span className="text-[11px] text-muted-foreground">automatisch gemaakt, kan fouten bevatten</span>
      </div>
      <p className="whitespace-pre-line text-sm">{item.summary}</p>
      {item.summaryPoints.length > 0 && (
        <>
          <h3 className={cn(LABEL, 'mt-1 text-muted-foreground')}>Voor ons</h3>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            {item.summaryPoints.map((point, index) => (
              <li key={index}>{point}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** The centre pane: the selected hint (for one area), assignment or news item to read */
function IntelReader({ item, area }: { item: IntelItem; area?: string }) {
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const type = TYPE_STYLE[item.type];
  const isHint = item.type === 'hint';
  const snippet = isHint && area ? item.cells.find((cell) => cell.area === area)?.snippet : undefined;

  const body = (
    <>
      <header className="flex flex-col gap-1">
        <span className={cn(LABEL, type.text)}>{type.label}</span>
        <h1 className="text-xl font-bold text-balance">{item.title}</h1>
        <p className="text-sm text-muted-foreground">
          Gepubliceerd <span className="tabular-nums">{formatClock(item.publishAt)}</span>
          {item.type === 'assignment' && item.maxPoints !== undefined && ` · max ${item.maxPoints} punten`}
        </p>
      </header>

      {!isHint && item.summary && <Summary item={item} />}

      {isHint && snippet && area ? (
        <>
          <h2 className={cn(LABEL, 'flex items-center gap-1.5 text-muted-foreground')}>
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: getColorFromArea(area) }} aria-hidden />
            Hint voor {capitalizeFirstLetter(area)}
          </h2>
          <HintContent html={snippet} onZoom={setZoomSrc} className={CONTENT} />
          <Collapsible>
            <CollapsibleTrigger className="group flex cursor-pointer items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
              Volledige hint
            </CollapsibleTrigger>
            <CollapsibleContent>
              <HintContent html={item.content} onZoom={setZoomSrc} className={cn(CONTENT, 'mt-2')} />
            </CollapsibleContent>
          </Collapsible>
        </>
      ) : (
        <>
          {!isHint && <h2 className={cn(LABEL, 'text-muted-foreground')}>Volledige tekst</h2>}
          <HintContent html={item.content} onZoom={setZoomSrc} className={CONTENT} />
        </>
      )}
    </>
  );

  // Keyed on the item and area: the text fades in on a switch and the "Volledige hint" fold starts closed again
  const key = `${item.id}-${area ?? ''}`;
  const className = 'mx-auto flex max-w-3xl flex-col gap-4 px-8 py-6';

  return (
    <>
      {reducedMotion ? (
        <div key={key} className={className}>
          {body}
        </div>
      ) : (
        <motion.div key={key} className={className} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
          {body}
        </motion.div>
      )}
      {zoomSrc && <ImageLightbox src={zoomSrc} alt={item.title} open onOpenChange={(open) => !open && setZoomSrc(null)} />}
    </>
  );
}

export default memo(IntelReader);
