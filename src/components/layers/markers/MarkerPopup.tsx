import { useState } from 'react';
import { Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import MapPopup from '../../map/MapPopup';
import CoordRows from '../../map/popup/CoordRows';
import { MapsAction, PopupActions, popupActionClass } from '../../map/popup/PopupActions';
import PopupHeader, { PopupIcon } from '../../map/popup/PopupHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useDistanceFromMe } from '@/hooks/distance-from-me.hook';
import { joinParts } from '@/lib/format';
import { areaKey, areaLetter } from '@/lib/marker-style';
import { formatMarkerTime } from '@/lib/markers';
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
  /** @returns true when the marker was deleted */
  deleteMarker: (id: string) => Promise<boolean>;
}

/** Marker details (WGS84 + RD coordinates), Google Maps and delete (with confirmation). */
export default function MarkerPopup({ marker, onClose, deleteMarker }: MarkerPopupProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lng, lat] = marker.location.coordinates;
  const distance = useDistanceFromMe(lat, lng);

  async function handleDelete() {
    const deleted = await deleteMarker(marker._id!);
    setConfirmOpen(false);
    if (deleted) {
      onClose();
      toast.success('Marker verwijderd!', { description: 'De marker is succesvol verwijderd.' });
    } else {
      toast.error('Fout bij verwijderen marker.', { description: 'Er is iets fout gegaan bij het verwijderen van de marker. Probeer het later opnieuw.' });
    }
  }

  return (
    <MapPopup longitude={lng} latitude={lat} onClose={onClose} offset={marker.type === MarkerType.Hint ? HINT_POPUP_OFFSET : POPUP_OFFSET}>
      <PopupHeader
        icon={
          <PopupIcon shape="square" background={getColorFromArea(marker.area)} color="#1a1a1a">
            {areaLetter(areaKey(marker.area) ?? 'none') || '?'}
          </PopupIcon>
        }
        title={`${capitalizeFirstLetter(marker.area)} · ${capitalizeFirstLetter(marker.type)}`}
        subtitle={joinParts(formatMarkerTime(marker.time), distance, marker.source === 'jotiboard' ? 'via Jotiboard' : undefined)}
      />
      <CoordRows lat={lat} lng={lng} />
      <PopupActions>
        <MapsAction lat={lat} lng={lng} label="Google Maps" />
        <button type="button" aria-label="Verwijderen" title="Verwijderen" className={popupActionClass('danger', 'w-[30px] px-0')} onClick={() => setConfirmOpen(true)}>
          <Trash2Icon />
        </button>
      </PopupActions>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Weet je het zeker?"
        description="Deze actie kan niet ongedaan gemaakt worden. Dit zal alle informatie van deze marker permanent verwijderen."
        confirmLabel="Doorgaan"
        destructive
        onConfirm={handleDelete}
      />
    </MapPopup>
  );
}
