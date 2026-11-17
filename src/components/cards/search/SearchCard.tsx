import * as React from "react"
import {ChevronDownIcon, SearchIcon} from "lucide-react"
import {AnimatePresence, motion} from "motion/react"

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
import LoadError from "@/components/LoadError";
import {Skeleton} from "@/components/ui/skeleton";
import {useTeams} from "@/hooks/teams.hook.ts";
import {Team} from "@/types/Team.ts";
import {cn} from "@/lib/utils.ts";
import {MAP_CHIP, MAP_TILE} from "@/lib/map-chrome.ts";
import {TRIGGER_OPEN} from "@/lib/menu-styles.ts";
import {loadState} from "@/lib/load-state.ts";
import {SWAP} from "@/lib/motion.ts";
import {TEAM_PINS_LAYER} from "@/lib/map-layers.ts";
import {activatedByKeyboard} from "@/lib/input-modality.ts";

/** Placeholder rows while the groups load, about as wide as group names */
const SKELETON_WIDTHS = ['70%', '55%', '80%', '62%', '48%'];

/** `onDone`: after flying to a group, e.g. to close the md popover that holds this card; `fluid`: fill the parent (phone drawer) instead of 300 px */
export default function SearchCard({ mapRef, onDone, fluid }: { mapRef: React.RefObject<MapRef | null>; onDone?: () => void; fluid?: boolean }) {
    const [open, setOpen] = React.useState(false)
    const {teams, isError, retry} = useTeams();
    // A failed later poll keeps the last list; only a first load that is still running or failed replaces it
    const state = loadState(teams, isError);

    function navigateToTeam(team: Team) {
        setOpen(false);
        mapRef.current?.flyTo({
            center: [team.location.coordinates[0], team.location.coordinates[1]],
            zoom: 14,
        });
        // The group's popup, as if its pin was clicked (nothing when the groups layer is off); focused for keyboard users
        mapRef.current?.openFeature(TEAM_PINS_LAYER, team._id, {focus: activatedByKeyboard()});
        onDone?.();
    }

    return (
        <div className={"w-full flex flex-col gap-2"}>
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                {/* A plain button (named by its text) that opens the search popover; Radix adds aria-haspopup/expanded */}
                <button
                    type="button"
                    // The "/" shortcut (Layout.tsx) finds and opens it
                    data-group-search
                    title="Snel navigeren naar groep (/)"
                    aria-keyshortcuts="/"
                    className={cn(
                        MAP_TILE,
                        "group flex h-11 items-center gap-2.5 rounded-[14px] pr-3 pl-1.5 text-left transition-colors hover:bg-beheer-row focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none",
                        fluid ? "w-full" : "w-[300px]",
                        TRIGGER_OPEN,
                    )}
                >
                    <span className={cn(MAP_CHIP, "transition-colors group-data-[state=open]:bg-[color-mix(in_oklab,var(--map-selected-fg)_12%,var(--map-selected-bg))]")}><SearchIcon/></span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">Snel navigeren naar groep…</span>
                    <ChevronDownIcon data-chevron className="size-4 shrink-0 opacity-50" />
                </button>
            </PopoverTrigger>
            <PopoverContent aria-label="Groep zoeken" className="w-(--radix-popover-trigger-width) p-3">
                <Command label="Groep zoeken">
                    <CommandInput placeholder="Zoeken…" />
                    <CommandList>
                        <AnimatePresence mode="wait" initial={false}>
                            {state === 'loading' ? (
                                <motion.div key="loading" {...SWAP} className="flex flex-col p-1" role="status" aria-label="Groepen laden">
                                    {SKELETON_WIDTHS.map((width) => (
                                        <div key={width} className="px-2 py-1.5">
                                            <Skeleton className="h-5" style={{width}}/>
                                        </div>
                                    ))}
                                </motion.div>
                            ) : state === 'error' ? (
                                <motion.div key="error" {...SWAP} className="px-2 py-5">
                                    <LoadError centered message="Groepen konden niet worden geladen." onRetry={retry}/>
                                </motion.div>
                            ) : (
                                <motion.div key="list" {...SWAP}>
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
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
        </div>
    )
}
