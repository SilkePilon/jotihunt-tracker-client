import * as React from "react"
import {ChevronsUpDownIcon, NavigationIcon} from "lucide-react"

import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {MapRef} from "@/components/Map.tsx";
import {useTeams} from "@/hooks/teams.hook.ts";
import {Team} from "@/types/Team.ts";
import {cn} from "@/lib/utils.ts";
import {MAP_CHIP, MAP_TILE} from "@/lib/map-chrome.ts";

export default function SearchCard({ mapRef }: { mapRef: React.RefObject<MapRef | null> }) {
    const [open, setOpen] = React.useState(false)
    const {teams} = useTeams();

    function navigateToTeam(team: Team) {
        setOpen(false);
        mapRef.current?.flyTo({
            center: [team.location.coordinates[0], team.location.coordinates[1]],
            zoom: 14,
            essential: true
        });
    }

    return (
        <div className={"w-full flex flex-col gap-2"}>
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        MAP_TILE,
                        "flex h-11 w-[300px] items-center gap-2.5 rounded-[14px] pr-3 pl-1.5 text-left transition-colors hover:bg-beheer-row focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                    )}
                >
                    <span className={MAP_CHIP}><NavigationIcon/></span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">Snel navigeren naar groep...</span>
                    <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-(--radix-popover-trigger-width) overflow-hidden rounded-2xl p-0">
                <Command>
                    <CommandInput placeholder="Zoeken..." />
                    <CommandList>

                        <CommandEmpty>Geen groepen gevonden.</CommandEmpty>
                        <CommandGroup>
                            {teams?.map((team) => (
                                <CommandItem
                                    key={team._id}
                                    value={team.name}
                                    onSelect={() => navigateToTeam(team)}
                                >
                                    {team.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>

                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
        </div>
    )
}
