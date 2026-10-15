import { XIcon } from 'lucide-react';
import { useMarkerPalette } from '@/components/layers/marker-icons';

const BAR = ['ok', 'ok', 'warn', 'ok', 'error', 'ok'] as const;

/** Illustration: a tilted phone running the app (map, vossen widget, floating toolbar) and a vossen home-screen widget. */
export default function AndroidPromoHero({ onClose }: { onClose: () => void }) {
  const p = useMarkerPalette();
  const fill = { ok: p.okContainer, warn: p.warnContainer, error: p.errorContainer };
  return (
    <div className="relative h-[170px] overflow-hidden" style={{ background: `radial-gradient(circle at 30% 20%, color-mix(in oklab, var(--primary) 35%, transparent), transparent 60%), ${p.tertiaryContainer}` }}>
      <button type="button" aria-label="Later" onClick={onClose} className="absolute right-2.5 top-2.5 z-10 grid size-[34px] place-items-center rounded-full bg-black/25 text-white">
        <XIcon className="size-5" />
      </button>
      <div className="absolute bottom-[-40px] left-1/2 h-[200px] w-[130px] -translate-x-1/2 -rotate-6 overflow-hidden rounded-[22px] bg-muted shadow-[0_0_0_5px_#111,0_14px_30px_rgb(0_0_0/.4)]" aria-hidden>
        <span className="absolute left-10 top-10 size-[22px] rounded-lg" style={{ background: p.okContainer, boxShadow: `0 0 0 2px ${p.surfaceContainerLowest}` }} />
        <span className="absolute left-20 top-20 size-[22px] rounded-full bg-primary" style={{ boxShadow: `0 0 0 2px ${p.surfaceContainerLowest}` }} />
        <div className="absolute inset-x-2 bottom-[46px] h-11 rounded-[14px] bg-card p-[7px]">
          <div className="flex gap-0.5">
            {BAR.map((k, i) => (
              <i key={i} className="h-1.5 flex-1 rounded-sm" style={{ background: fill[k] }} />
            ))}
          </div>
          <div className="mt-[5px] text-[8px] font-bold">41 km vandaag</div>
        </div>
        <div className="absolute inset-x-[22px] bottom-3 h-[26px] rounded-[13px] bg-card" />
      </div>
      <div className="absolute left-[18px] top-[22px] size-[90px] rotate-[8deg] rounded-[22px] bg-card p-2.5 shadow-[0_10px_24px_rgb(0_0_0/.3)]" aria-hidden>
        <div className="text-[9px] font-extrabold text-muted-foreground">VOSSEN</div>
        <div className="mt-1.5 grid grid-cols-3 gap-[3px]">
          {(['ok', 'ok', 'warn', 'ok', 'warn', 'ok'] as const).map((k, i) => (
            <i key={i} className="h-4 rounded-[5px]" style={{ background: fill[k] }} />
          ))}
        </div>
      </div>
    </div>
  );
}
