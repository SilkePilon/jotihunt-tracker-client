import { useState } from 'react';
import { MapPinIcon } from 'lucide-react';
import { toast } from 'sonner';
import MapPopup from '../../map/MapPopup';
import { PopupActions, RouteAction } from '../../map/popup/PopupActions';
import { PopupRow, PopupRows } from '../../map/popup/PopupRows';
import PopupHeader from '../../map/popup/PopupHeader';
import TeamLogo from '../../map/TeamLogo';
import { VisitStatusRow, VisitToggleButton } from '../../map/VisitControls';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAreas } from '@/hooks/areas.hook';
import { useDistanceFromMe } from '@/hooks/distance-from-me.hook';
import { usePredictionSetting } from '@/hooks/predictions.hook';
import { getColorFromArea } from '@/lib/utils';
import type { Team } from '@/types/Team';

const TEAMS_AREA_EDITING = import.meta.env.TEAMS_AREA_EDITING === 'true';

interface TeamPopupProps {
  /** The team from the current SWR data */
  team: Team;
  onClose: () => void;
  /** @returns true when the server stored the area (the team list has been revalidated by then) */
  setTeamArea: (id: string, area: string | undefined) => Promise<boolean>;
}

// Above the group (28px circle, centred)
const POPUP_OFFSET = { bottom: [0, -16] as [number, number] };

/** Details of a group: address, visit status, area select (TEAMS_AREA_EDITING) and Route. */
export default function TeamPopup({ team, onClose, setTeamArea }: TeamPopupProps) {
  const { areas } = useAreas();
  const { enabled: predictionEnabled } = usePredictionSetting();
  // Optimistic area while saving; dropped once the save settles, so the (revalidated) team list shows the outcome
  const [pendingArea, setPendingArea] = useState<{ teamId: string; area: string | undefined }>();
  const area = pendingArea?.teamId === team._id ? pendingArea.area : team.area;
  const [lng, lat] = team.location.coordinates;
  const distance = useDistanceFromMe(lat, lng);
  const showVisits = !!area && predictionEnabled !== false;

  /**
   * Handle area change from the select.
   * Disabled if TEAMS_AREA_EDITING is false.
   * @param value The new area to set.
   */
  async function handleAreaChange(value: string) {
    if (!TEAMS_AREA_EDITING) return;
    const pending = { teamId: team._id, area: value === 'onbekend' ? undefined : value };
    setPendingArea(pending);
    const saved = await setTeamArea(pending.teamId, pending.area);
    // Only clear our own edit, not a newer one made while this save was in flight
    setPendingArea((current) => (current === pending ? undefined : current));
    if (!saved) toast.error('Deelgebied opslaan mislukt');
  }

  const address = `${team.street} ${team.houseNumber}${team.housenumberAddition ? ` ${team.housenumberAddition}` : ''}, ${team.city}`;

  return (
    <MapPopup longitude={lng} latitude={lat} onClose={onClose} offset={POPUP_OFFSET}>
      <PopupHeader
        icon={<TeamLogo name={team.name} logoUrl={team.logoUrl} className="size-9 rounded-[11px] border-0 shadow-none" />}
        title={team.name}
        subtitle={
          <>
            {area ? (
              <span className="capitalize">
                <span style={{ color: getColorFromArea(area) }}>●</span> {area}
              </span>
            ) : (
              'Geen deelgebied'
            )}
            {distance && ` · ${distance}`}
          </>
        }
      />
      <PopupRows>
        <PopupRow icon={<MapPinIcon />} title={team.accomodation || address} meta={team.accomodation ? address : undefined} />
        {showVisits && <VisitStatusRow teamApiId={team.apiId} />}
      </PopupRows>
      {TEAMS_AREA_EDITING && (
        <Select onValueChange={handleAreaChange} value={area ?? 'onbekend'}>
          <SelectTrigger autoFocus={false} size="sm" className="mt-2 w-full">
            <SelectValue placeholder="Kies deelgebied..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="onbekend">Onbekend deelgebied</SelectItem>
            {areas?.map((option) => (
              <SelectItem key={option._id} value={option.name}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <PopupActions>
        <RouteAction lat={lat} lng={lng} />
        {showVisits && <VisitToggleButton teamApiId={team.apiId} />}
      </PopupActions>
    </MapPopup>
  );
}
