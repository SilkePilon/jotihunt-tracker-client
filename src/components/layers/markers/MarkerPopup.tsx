import { useState } from 'react';
import { Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import MapPopup from '../../map/MapPopup';
import GoogleMapsButton from '../../map/GoogleMapsButton';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { formatMarkerTime } from '@/lib/markers';
import { toRD } from '@/lib/rd';
import { capitalizeFirstLetter } from '@/lib/utils';
import type { Marker } from '@/types/Marker';

const POPUP_OFFSET = { bottom: [0, -20] as [number, number] };

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
  const rd = toRD(lng, lat);

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
    <MapPopup longitude={lng} latitude={lat} onClose={onClose} offset={POPUP_OFFSET}>
      <div className="flex flex-col gap-2">
        <div>
          <h2 className="font-semibold">
            {capitalizeFirstLetter(marker.area)} - {formatMarkerTime(marker.time)}
          </h2>
          <p>Soort marker: {capitalizeFirstLetter(marker.type)}</p>
          <p>Breedtegraad: {lat.toFixed(7)}</p>
          <p>Lengtegraad: {lng.toFixed(7)}</p>
          <p>RD-x: {rd.x.toFixed(0)}</p>
          <p>RD-y: {rd.y.toFixed(0)}</p>
        </div>
        <div className="flex flex-col gap-2 w-full">
          <GoogleMapsButton lat={lat} lng={lng} />
          <Button variant="destructive" size="sm" className="w-full" onClick={() => setConfirmOpen(true)}>
            <Trash2Icon /> Verwijderen
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Weet je het zeker?"
            description="Deze actie kan niet ongedaan gemaakt worden. Dit zal alle informatie van deze marker permanent verwijderen."
            confirmLabel="Doorgaan"
            destructive
            onConfirm={handleDelete}
          />
        </div>
      </div>
    </MapPopup>
  );
}
