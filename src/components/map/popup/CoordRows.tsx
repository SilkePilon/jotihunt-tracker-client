import { LightbulbIcon } from 'lucide-react';
import CopyButton from '@/components/CopyButton';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCoordinates } from '@/lib/hunters';
import { toRD } from '@/lib/rd';

const COPIED = 'Coördinaten gekopieerd naar klembord!';

function Row({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-[10px] bg-(--map-surface-high) py-1 pr-1 pl-2">
      <div className="min-w-0">
        <div className="text-[10px] tracking-wide text-(--map-muted) uppercase">{label}</div>
        <div className="tabular-nums">{value}</div>
      </div>
      <div className="flex shrink-0 text-(--map-on-surface-variant)">{children}</div>
    </div>
  );
}

/**
 * WGS84 (5 decimals shown, 7 copied) and RD rows with copy buttons; `onHint` adds the lightbulb that puts the RD
 * coordinates into the hint registration.
 */
export default function CoordRows({ lat, lng, onHint }: { lat: number; lng: number; onHint?: (rd: { x: string; y: string }) => void }) {
  const rdMetres = toRD(lng, lat);
  const rd = { x: rdMetres.x.toFixed(0), y: rdMetres.y.toFixed(0) };

  return (
    <div className="mt-2 flex flex-col gap-1">
      <Row label="WGS84" value={formatCoordinates(lat, lng)}>
        <CopyButton value={`${lat.toFixed(7)}, ${lng.toFixed(7)}`} label="Coördinaten" successMessage={COPIED} variant="ghost" />
      </Row>
      <Row label="RD" value={`${rd.x} · ${rd.y}`}>
        {onHint && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label="Plaats coördinaten in hint registratie" onClick={() => onHint(rd)}>
                <LightbulbIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Plaats coördinaten in hint registratie.</TooltipContent>
          </Tooltip>
        )}
        <CopyButton value={`${rd.x}, ${rd.y}`} label="RD-coördinaten" successMessage={COPIED} variant="ghost" />
      </Row>
    </div>
  );
}
