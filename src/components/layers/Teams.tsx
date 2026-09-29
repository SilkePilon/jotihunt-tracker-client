import {Layer, Marker, Source, useMap} from 'react-map-gl/maplibre';
import {useTeams} from '@/hooks/teams.hook.ts';
import MapMarker from '../map/MapMarker';
import {useCallback, useMemo, useState} from 'react';
import {Team} from '@/types/Team';
import MapPopup from '../map/MapPopup';
import {cn, createCircle, getColorFromArea} from '@/lib/utils';
import {useAreas} from '@/hooks/areas.hook';
import GoogleMapsButton from '../map/GoogleMapsButton';
import {Badge} from '../ui/badge';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '../ui/select';
import useLayersStore from '@/stores/layers.store';
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip.tsx";
import {CheckIcon} from 'lucide-react';
import {usePredictionSetting, useVisits} from '@/hooks/predictions.hook';
import VisitControls from '../map/VisitControls';
import TeamLogo from '../map/TeamLogo';
import {useIsMobile} from '@/hooks/media.hook';

/** On phones the bottom sheet covers the lower ~130px; aim a bit higher so the team isn't hidden behind it. */
const MOBILE_CENTER_OFFSET: [number, number] = [0, -65];

const HOME_TEAM_API_ID = import.meta.env.HOME_TEAM_API_ID;
const TEAMS_AREA_EDITING = import.meta.env.TEAMS_AREA_EDITING === 'true';

export default function Teams() {

    const {showGroupCircles} = useLayersStore();
    const {current: map} = useMap();
    const isMobile = useIsMobile();
    const {teams, setTeamArea} = useTeams();
    const {isVisible} = useAreas();

    const [activeTeam, setActiveTeam] = useState<Team>();
    const [tooltipOpenId, setTooltipOpenId] = useState<string | null>(null);
    const {areas} = useAreas();
    const {visits} = useVisits();
    const {enabled: predictionEnabled} = usePredictionSetting();
    const visitedIds = useMemo(
        () => new Set((visits ?? []).filter((visit) => visit.state === 'visited').map((visit) => visit.teamApiId)),
        [visits],
    );

    /**
     * Handle area change from the select.
     * Disabled if TEAMS_AREA_EDITING is false.
     * @param area The new area to set.
     */
    function handleAreaChange(area: string) {
        if (!TEAMS_AREA_EDITING) return;
        if (!activeTeam) return;
        const newArea = area === 'onbekend' ? undefined : area;
        setActiveTeam({...activeTeam, area: newArea});
        setTeamArea(activeTeam._id, newArea);
    }

    /**
     * Handle the tooltip for a marker.
     * @param open Whether the tooltip should be open or closed.
     * @param teamId The ID of the device for which the tooltip is being handled.
     */
    const handleMarkerTooltip = useCallback((open: boolean, teamId: string) => {
        if (activeTeam) {
            setTooltipOpenId(null);
            return;
        }

        setTooltipOpenId(open ? teamId : null);
    }, [activeTeam]);

    const markers = useMemo(() => {
        return teams
            ?.filter((team) => isVisible(team.area || ''))
            .map((team) => (
                <div key={team._id}>
                    <Marker
                        longitude={team.location.coordinates[0]}
                        latitude={team.location.coordinates[1]}
                        anchor="bottom"
                        onClick={(e) => {
                            e.originalEvent.stopPropagation();
                            if (activeTeam?._id === team._id) {
                                setActiveTeam(undefined);
                            } else {
                                setActiveTeam(team);
                                map?.easeTo({
                                    center: [team.location.coordinates[0], team.location.coordinates[1]],
                                    offset: isMobile ? MOBILE_CENTER_OFFSET : [0, 0],
                                    duration: 600,
                                });
                            }
                        }}
                        style={{cursor: 'pointer'}}
                        className={cn(tooltipOpenId === team._id && 'z-20')}
                    >
                        <Tooltip
                            delayDuration={0}
                            open={tooltipOpenId === team._id && !activeTeam}
                            onOpenChange={(open) => handleMarkerTooltip(open, team._id)}
                        >
                            <TooltipTrigger asChild>
                                <div data-team-api-id={team.apiId}
                                     className="relative hover:brightness-125 hover:scale-105 transition-all ease-in-out">
                                    <MapMarker color={getColorFromArea(team.area || '')}/>
                                    {visitedIds.has(team.apiId) && (
                                        <span aria-label="Bezocht"
                                              className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-green-600 text-white ring-2 ring-white">
                                            <CheckIcon className="size-2.5" strokeWidth={3}/>
                                        </span>
                                    )}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent className={"flex gap-2 items-center"}>
                                <span className="text-sm font-medium">{team.name}</span>
                                {team.area && (
                                    <Badge
                                        className="text-white border-0"
                                        style={{
                                            backgroundColor: getColorFromArea(team.area || ''),
                                        }}
                                    >
                                        {team.area ?? 'Onbekend'}
                                    </Badge>
                                )}
                            </TooltipContent>
                        </Tooltip>
                    </Marker>
                    {showGroupCircles && team.apiId != HOME_TEAM_API_ID && (
                        <Source key={team.apiId} id={`circle-team-${team.apiId}`} type="geojson"
                                data={createCircle(team.location.coordinates[0], team.location.coordinates[1], 500)}>
                            <Layer
                                id={`circle-team-layer-${team.apiId}`}
                                type="fill"
                                paint={{
                                    'fill-color': `${getColorFromArea(team.area || '')}`,
                                    'fill-opacity': 0.2,
                                }}
                            />
                        </Source>
                    )}
                </div>
            ));
    }, [teams, isVisible, activeTeam, tooltipOpenId, showGroupCircles, handleMarkerTooltip, visitedIds, map, isMobile]);

    return (
        <>
            {markers}
            {activeTeam && (
                <MapPopup longitude={activeTeam.location.coordinates[0]} latitude={activeTeam.location.coordinates[1]}
                          onClose={() => setActiveTeam(undefined)}>
                    <div className="mr-5 flex w-64 flex-col gap-2 text-sm">
                        <div className="flex items-center gap-2.5">
                            <TeamLogo name={activeTeam.name} logoUrl={activeTeam.logoUrl} className="size-11 rounded-lg"/>
                            <div className="min-w-0">
                                <h2 className="font-semibold leading-tight">{activeTeam.name}</h2>
                                <div className="mt-1">
                                    {activeTeam.area ? (
                                        <Badge className="border-0 text-white capitalize"
                                               style={{backgroundColor: getColorFromArea(activeTeam.area)}}>
                                            {activeTeam.area}
                                        </Badge>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">Geen deelgebied</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <p className="text-xs leading-snug text-muted-foreground">
                            {activeTeam.accomodation} · {activeTeam.street} {activeTeam.houseNumber}{activeTeam.houseNumberAddition ? ` ${activeTeam.houseNumberAddition}` : ''}, {activeTeam.postCode} {activeTeam.city}
                        </p>
                        {activeTeam.area && predictionEnabled !== false && <VisitControls teamApiId={activeTeam.apiId}/>}
                        {/* Select with areas */}
                        <div className="flex flex-col gap-2">
                            {TEAMS_AREA_EDITING && (
                                <Select onValueChange={handleAreaChange} value={activeTeam.area ?? 'onbekend'}>
                                    <SelectTrigger autoFocus={false} className="w-full">
                                        <SelectValue placeholder="Kies deelgebied..."/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="onbekend">Onbekend deelgebied</SelectItem>
                                        {areas?.map((area) => (
                                            <SelectItem key={area._id} value={area.name}>
                                                {area.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <GoogleMapsButton lat={activeTeam.location.coordinates[1]}
                                              lng={activeTeam.location.coordinates[0]}/>
                        </div>

                    </div>
                </MapPopup>
            )}
        </>
    );
}
