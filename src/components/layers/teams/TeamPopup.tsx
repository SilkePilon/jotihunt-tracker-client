import { useState } from 'react';
import { toast } from 'sonner';
import MapPopup from '../../map/MapPopup';
import GoogleMapsButton from '../../map/GoogleMapsButton';
import VisitControls from '../../map/VisitControls';
import TeamLogo from '../../map/TeamLogo';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAreas } from '@/hooks/areas.hook';
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

/** Details of a group: address, visit status, area select (TEAMS_AREA_EDITING) and Google Maps. */
export default function TeamPopup({ team, onClose, setTeamArea }: TeamPopupProps) {
  const { areas } = useAreas();
  const { enabled: predictionEnabled } = usePredictionSetting();
  // Optimistic area while saving; dropped once the save settles, so the (revalidated) team list shows the outcome
  const [pendingArea, setPendingArea] = useState<{ teamId: string; area: string | undefined }>();
  const area = pendingArea?.teamId === team._id ? pendingArea.area : team.area;

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

  const [lng, lat] = team.location.coordinates;

  return (
    <MapPopup longitude={lng} latitude={lat} onClose={onClose} offset={POPUP_OFFSET}>
      <div className="mr-5 flex w-64 flex-col gap-2 text-sm">
        <div className="flex items-center gap-2.5">
          <TeamLogo name={team.name} logoUrl={team.logoUrl} className="size-11 rounded-lg" />
          <div className="min-w-0">
            <h2 className="font-semibold leading-tight">{team.name}</h2>
            <div className="mt-1">
              {area ? (
                <Badge className="border-0 text-white capitalize" style={{ backgroundColor: getColorFromArea(area) }}>
                  {area}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">Geen deelgebied</span>
              )}
            </div>
          </div>
        </div>
        <p className="text-xs leading-snug text-muted-foreground">
          {team.accomodation} · {team.street} {team.houseNumber}
          {team.housenumberAddition ? ` ${team.housenumberAddition}` : ''}, {team.postCode} {team.city}
        </p>
        {area && predictionEnabled !== false && <VisitControls teamApiId={team.apiId} />}
        <div className="flex flex-col gap-2">
          {TEAMS_AREA_EDITING && (
            <Select onValueChange={handleAreaChange} value={area ?? 'onbekend'}>
              <SelectTrigger autoFocus={false} className="w-full">
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
          <GoogleMapsButton lat={lat} lng={lng} />
        </div>
      </div>
    </MapPopup>
  );
}
