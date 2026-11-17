import { useState } from 'react';
import { Trash2Icon } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import MapPopup from '../../map/MapPopup';
import CoordRows from '../../map/popup/CoordRows';
import { ICON_ACTION, PopupActions, popupActionClass, RouteAction } from '../../map/popup/PopupActions';
import PopupHeader, { PopupIcon } from '../../map/popup/PopupHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import InlineError from '@/components/InlineError';
import Reveal from '@/components/motion/Reveal';
import { useDistanceFromMe } from '@/hooks/distance-from-me.hook';
import { useEdition } from '@/hooks/edition.hook';
import { AGE_CLOCK_TICK_MS, useNow } from '@/hooks/now.hook';
import { useSyncedHunts } from '@/hooks/hunt-sync.hook';
import { apiErrorMessage, isNetworkError } from '@/lib/api-error';
import { formatClock, joinParts } from '@/lib/format';
import { huntLocationNote, syncedHuntForMarker } from '@/lib/hunt-sync';
import { markerDeleteDescription, markerTimeLabel } from '@/lib/markers';
import { revealTransition } from '@/lib/motion';
import { areaKey, areaLetter } from '@/lib/marker-style';
import { capitalizeFirstLetter, getColorFromArea } from '@/lib/utils';
import type { Marker } from '@/types/Marker';
import { MarkerType } from '@/types/MarkerType';

// Above the fox (38px shape, centred), or above a hint's label (which hangs ~29px above its point)
const POPUP_OFFSET = { bottom: [0, -20] as [number, number] };
const HINT_POPUP_OFFSET = { bottom: [0, -32] as [number, number] };

interface MarkerPopupProps {
  /** The marker from the current SWR data */
  marker: Marker;
  onClose: () => void;
  /** @returns null when the marker was deleted, else the error (never throws) */
  deleteMarker: (id: string) => Promise<unknown>;
}

/** Marker details (WGS84 + RD coordinates), Route and delete (with confirmation). */
export default function MarkerPopup({ marker, onClose, deleteMarker }: MarkerPopupProps) {
  const reduced = useReducedMotion() ?? false;
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Why the last delete failed: the confirmation stays open with it and "Opnieuw proberen"
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { readOnly } = useEdition();
  const [lng, lat] = marker.location.coordinates;
  const distance = useDistanceFromMe(lat, lng);
  // "45 min geleden" moves while the popup is open
  const now = useNow(true, AGE_CLOCK_TICK_MS);
  const { hunts } = useSyncedHunts();
  const locationNote = huntLocationNote(syncedHuntForMarker(marker, hunts)?.location);

  function changeConfirmOpen(next: boolean) {
    if (!next) setDeleteError(null);
    setConfirmOpen(next);
  }

  async function handleDelete() {
    setDeleteError(null);
    const failure = await deleteMarker(marker._id!);
    if (failure) {
      setDeleteError(isNetworkError(failure) ? 'Geen verbinding. Probeer het opnieuw zodra je verbinding hebt.' : apiErrorMessage(failure, 'Probeer het opnieuw.'));
      return;
    }
    changeConfirmOpen(false);
    onClose();
    toast.success('Marker verwijderd');
  }

  return (
    <MapPopup longitude={lng} latitude={lat} onClose={onClose} offset={marker.type === MarkerType.Hint ? HINT_POPUP_OFFSET : POPUP_OFFSET} offsetScale="label">
      <PopupHeader
        icon={
          <PopupIcon shape="square" background={getColorFromArea(marker.area)} color="#1a1a1a">
            {areaLetter(areaKey(marker.area) ?? 'none') || '?'}
          </PopupIcon>
        }
        title={`${capitalizeFirstLetter(marker.area)} · ${capitalizeFirstLetter(marker.type)}`}
        subtitle={joinParts(markerTimeLabel(marker.time, now), distance, marker.source === 'jotiboard' ? 'via Jotiboard' : undefined)}
      />
      {/* A synced hunt placed from our own trackers (jotihunt.nl shows no location): muted, under the title */}
      <AnimatePresence initial={false}>
        {locationNote && (
          <motion.p
            key="estimate"
            className="overflow-hidden pl-[46px] text-xs leading-snug text-(--map-muted)"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0, transition: revealTransition(reduced, 'exit') }}
            transition={revealTransition(reduced, 'enter')}
          >
            {locationNote}
          </motion.p>
        )}
      </AnimatePresence>
      <CoordRows lat={lat} lng={lng} />
      <PopupActions>
        <RouteAction lat={lat} lng={lng} />
        <button type="button" aria-label="Verwijderen" title="Verwijderen" className={popupActionClass('danger', ICON_ACTION)} disabled={readOnly} onClick={() => setConfirmOpen(true)}>
          <Trash2Icon />
        </button>
      </PopupActions>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={changeConfirmOpen}
        title="Marker verwijderen?"
        description={markerDeleteDescription(marker, formatClock(marker.time))}
        confirmLabel={deleteError ? 'Opnieuw proberen' : 'Verwijderen'}
        destructive
        onConfirm={handleDelete}
      >
        {/* Cancels the dialog's gap above its extra content while there is no error, so the error unfolds instead of popping */}
        <div className="-mt-4">
          <Reveal>
            {deleteError && (
              <div className="pt-4">
                <InlineError role="alert">Verwijderen mislukt: {deleteError}</InlineError>
              </div>
            )}
          </Reveal>
        </div>
      </ConfirmDialog>
    </MapPopup>
  );
}
