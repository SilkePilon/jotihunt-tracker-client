import { type RefObject, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import ImageLightbox from '@/components/ImageLightbox';
import type { MapRef } from '@/components/Map';
import { SWAP, SWAP_TRANSITION } from '@/lib/motion';
import type { LookAtPointResult } from '@/types/IntelChat';
import { Row, ShowOnMapPill } from './PointCard';

/** Height of 4 lines of the description (12.5px text, leading-5) */
const CLAMP_PX = 80;

/** lookAtPoint card: aerial thumbnail (click: lightbox), what the AI saw (4 lines, "meer"), RD and "Toon op kaart" */
export default function LookCard({ look, mapRef }: { look: LookAtPointResult; mapRef: RefObject<MapRef | null> }) {
  const [zoom, setZoom] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const { point } = look;
  return (
    <div className="overflow-hidden rounded-[18px] bg-beheer-row">
      <div className="flex gap-3 px-3 pt-3">
        <button
          type="button"
          aria-label="Luchtfoto vergroten"
          onClick={() => setZoom(true)}
          className="size-24 shrink-0 cursor-zoom-in overflow-hidden rounded-xl bg-beheer-row-high outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <AnimatePresence mode="wait" initial={false}>
            {failed ? (
              <motion.div
                key="failed"
                className="flex size-full items-center justify-center p-2 text-center text-[11.5px] text-muted-foreground"
                {...SWAP}
              >
                Luchtfoto niet beschikbaar
              </motion.div>
            ) : (
              <motion.img
                key="image"
                src={look.imageUrl}
                alt={`Luchtfoto bij ${point.label}`}
                className="size-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: loaded ? 1 : 0 }}
                transition={SWAP_TRANSITION}
                onLoad={() => setLoaded(true)}
                onError={() => setFailed(true)}
              />
            )}
          </AnimatePresence>
        </button>
        <Description text={look.description} />
      </div>
      <ImageLightbox src={look.imageUrl} alt={`Luchtfoto bij ${point.label}`} open={zoom} onOpenChange={setZoom} />
      <div className="grid gap-1.5 px-3 py-2.5 text-[12.5px]">
        <Row name="RD">
          <span className="font-mono tabular-nums">{point.rdText}</span>
        </Row>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <ShowOnMapPill point={point} mapRef={mapRef} />
        </div>
      </div>
    </div>
  );
}

/** Muted text clamped to 4 lines; when longer a "meer" / "minder" toggle unfolds it smoothly */
function Description({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setOverflows(element.scrollHeight > CLAMP_PX + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  return (
    <div className="flex min-w-0 flex-1 flex-col items-start">
      <motion.div
        className="overflow-hidden"
        initial={false}
        animate={{ height: open || !overflows ? 'auto' : CLAMP_PX }}
        transition={SWAP_TRANSITION}
      >
        <p ref={ref} className="text-[12.5px] leading-5 break-words whitespace-pre-wrap text-muted-foreground">
          {text}
        </p>
      </motion.div>
      <AnimatePresence initial={false}>
        {overflows && (
          <motion.button
            key="toggle"
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="mt-0.5 rounded-md text-[12px] font-semibold text-foreground outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
            {...SWAP}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={open ? 'minder' : 'meer'} className="block" {...SWAP}>
                {open ? 'minder' : 'meer'}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
