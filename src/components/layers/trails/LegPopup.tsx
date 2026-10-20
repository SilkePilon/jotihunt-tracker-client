import { useState, type ReactNode } from 'react';
import { CarIcon, ClockIcon, FootprintsIcon, RouteIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import MapPopup from '../../map/MapPopup';
import { PopupActions, popupActionClass } from '../../map/popup/PopupActions';
import PopupHeader, { PopupIcon } from '../../map/popup/PopupHeader';
import { PopupRow, PopupRows } from '../../map/popup/PopupRows';
import { useEdition } from '@/hooks/edition.hook';
import { POP, REVEAL_TRANSITION, SWAP } from '@/lib/motion';
import { flipLabel, flipTarget, legRows, legSubtitle, legTitle } from '@/lib/trails';
import { capitalizeFirstLetter } from '@/lib/utils';
import type { TrailProperties } from '@/types/Trail';

// Just above the clicked point on the line
const POPUP_OFFSET = { bottom: [0, -8] as [number, number] };

/** Text that swaps (blur/slide) when it changes, e.g. after flipping the leg's mode. */
function Swap({ text }: { text: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span key={text} className="block truncate" {...SWAP}>
        {text}
      </motion.span>
    </AnimatePresence>
  );
}

interface LegPopupProps {
  /** The leg from the current trails data */
  leg: TrailProperties;
  /** The clicked point */
  longitude: number;
  latitude: number;
  onClose: () => void;
  /** PATCH the leg's mode (`null` = back to automatic); the leg is keyed by the marker it ends at */
  onSetMode: (markerId: string, legMode: 'walk' | 'car' | null) => Promise<void>;
}

/** Trail leg (popup B): why it is walk or car, its time and route, one flip button and a way back to automatic. */
export default function LegPopup({ leg, longitude, latitude, onClose, onSetMode }: LegPopupProps) {
  const [saving, setSaving] = useState(false);
  // An archive edition is read-only: the leg's mode can't be changed
  const { readOnly } = useEdition();
  const rows = legRows(leg);
  const car = leg.mode !== 'walk';

  async function apply(mode: 'walk' | 'car' | null) {
    setSaving(true);
    try {
      await onSetMode(leg.toId, mode);
    } catch {
      toast.error('Opslaan mislukt');
    } finally {
      setSaving(false);
    }
  }

  const icon: ReactNode = (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={car ? 'car' : 'walk'} {...POP}>
        {car ? (
          <PopupIcon shape="square" background="var(--primary-container)" color="var(--on-primary-container)">
            <CarIcon />
          </PopupIcon>
        ) : (
          <PopupIcon shape="square" background="var(--beheer-row-high)" color="var(--map-on-surface)">
            <FootprintsIcon />
          </PopupIcon>
        )}
      </motion.div>
    </AnimatePresence>
  );

  return (
    <MapPopup longitude={longitude} latitude={latitude} onClose={onClose} offset={POPUP_OFFSET}>
      <PopupHeader icon={icon} title={<Swap text={legTitle(leg, capitalizeFirstLetter(leg.area))} />} subtitle={<Swap text={legSubtitle(leg)} />} />
      <PopupRows>
        <PopupRow icon={<ClockIcon />} title={<Swap text={rows.time.title} />} meta={<Swap text={rows.time.meta} />} />
        <PopupRow icon={<RouteIcon />} title={<Swap text={rows.route.title} />} meta={<Swap text={rows.route.meta} />} />
      </PopupRows>
      <PopupActions>
        <button type="button" disabled={saving || readOnly} className={popupActionClass('primary', 'min-w-0 flex-1')} onClick={() => void apply(flipTarget(leg))}>
          {car ? <FootprintsIcon /> : <CarIcon />}
          <Swap text={flipLabel(leg)} />
        </button>
      </PopupActions>
      <AnimatePresence initial={false}>
        {leg.manual && (
          <motion.div key="reset" className="overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={REVEAL_TRANSITION}>
            <button
              type="button"
              disabled={saving || readOnly}
              className="mt-1.5 w-full rounded-md py-1 text-center text-xs text-(--map-muted) underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
              onClick={() => void apply(null)}
            >
              Terug naar automatisch
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </MapPopup>
  );
}
