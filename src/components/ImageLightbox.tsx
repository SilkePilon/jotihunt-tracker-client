import { useRef, useState } from 'react';
import { MinusIcon, PlusIcon, RotateCcwIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const STEP = 1.4;

type View = { scale: number; x: number; y: number };
const START: View = { scale: 1, x: 0, y: 0 };

const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

/**
 * Full-screen photo viewer with zoom: mouse wheel, pinch, double click/tap and +/- buttons; drag to pan when zoomed.
 */
export default function ImageLightbox({ src, alt, open, onOpenChange }: { src: string; alt: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [view, setView] = useState<View>(START);
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);

  function zoom(factor: number) {
    setView((current) => {
      const scale = clampScale(current.scale * factor);
      return scale === 1 ? START : { ...current, scale };
    });
  }

  function pointerDistance() {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setDragging(true);
    if (pointers.current.size === 2) pinchStart.current = { distance: pointerDistance(), scale: view.scale };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pinch = pinchStart.current;
    if (pinch && pointers.current.size === 2) {
      const scale = clampScale((pinch.scale * pointerDistance()) / pinch.distance);
      setView((current) => (scale === 1 ? START : { ...current, scale }));
      return;
    }
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    setView((current) => (current.scale > 1 ? { ...current, x: current.x + dx, y: current.y + dy } : current));
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) setDragging(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) setView(START);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="h-dvh w-screen max-w-none gap-0 rounded-none border-0 bg-black/95 p-0 sm:max-w-none">
        <DialogTitle className="sr-only">Foto</DialogTitle>
        <DialogDescription className="sr-only">Zoom met scrollen, knijpen of dubbelklikken; sleep om te verschuiven.</DialogDescription>
        <div
          className="relative h-full w-full cursor-grab touch-none overflow-hidden active:cursor-grabbing"
          onWheel={(event) => zoom(event.deltaY < 0 ? 1.15 : 1 / 1.15)}
          onDoubleClick={() => setView((current) => (current.scale > 1 ? START : { ...current, scale: 2.5 }))}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <img
            src={src}
            alt={alt}
            draggable={false}
            className="h-full w-full select-none object-contain"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transition: dragging ? 'none' : 'transform 120ms ease-out' }}
          />
        </div>
        <div className="absolute right-3 top-3 flex gap-2">
          <Button variant="secondary" size="icon" aria-label="Uitzoomen" onClick={() => zoom(1 / STEP)} disabled={view.scale <= MIN_SCALE}>
            <MinusIcon />
          </Button>
          <Button variant="secondary" size="icon" aria-label="Inzoomen" onClick={() => zoom(STEP)} disabled={view.scale >= MAX_SCALE}>
            <PlusIcon />
          </Button>
          <Button variant="secondary" size="icon" aria-label="Zoom herstellen" onClick={() => setView(START)} disabled={view.scale === 1}>
            <RotateCcwIcon />
          </Button>
          <Button variant="secondary" size="icon" aria-label="Sluiten" onClick={() => handleOpenChange(false)}>
            <XIcon />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
