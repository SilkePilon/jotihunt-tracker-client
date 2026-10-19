import { LightbulbIcon } from 'lucide-react';
import CopyButton from '@/components/CopyButton';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCoordinates } from '@/lib/hunters';
import { toRD } from '@/lib/rd';
import { PopupRow, PopupRows } from './PopupRows';

const COPIED = 'Coördinaten gekopieerd naar klembord!';

/**
 * WGS84 (5 decimals shown, 7 copied) and RD rows with copy buttons; `onHint` adds the lightbulb that puts the RD
 * coordinates into the hint registration.
 */
export default function CoordRows({ lat, lng, onHint }: { lat: number; lng: number; onHint?: (rd: { x: string; y: string }) => void }) {
  const rdMetres = toRD(lng, lat);
  const rd = { x: rdMetres.x.toFixed(0), y: rdMetres.y.toFixed(0) };

  return (
    <PopupRows>
      <PopupRow label="WGS84" title={formatCoordinates(lat, lng)} trailing={<CopyButton value={`${lat.toFixed(7)}, ${lng.toFixed(7)}`} label="Coördinaten" successMessage={COPIED} variant="ghost" />} />
      <PopupRow
        label="RD"
        title={`${rd.x} · ${rd.y}`}
        trailing={
          <>
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
          </>
        }
      />
    </PopupRows>
  );
}
