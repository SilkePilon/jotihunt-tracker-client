import {CrosshairIcon} from "lucide-react";
import * as React from "react";
import {MapRef} from "@/components/Map.tsx";
import {useId, useState} from "react";
import type {LngLat} from "maplibre-gl";
import {AnimatePresence, motion} from "motion/react";
import {cn} from "@/lib/utils.ts";
import {parseToWGS84} from "@/lib/coordinates.ts";
import {isInNetherlands} from "@/lib/netherlands.ts";
import {MAP_CHIP, MAP_TILE} from "@/lib/map-chrome.ts";
import {SWAP_TRANSITION} from "@/lib/motion.ts";
import {COARSE_HIT_AREA} from "@/lib/hit-area.ts";
import {activatedByKeyboard} from "@/lib/input-modality.ts";

/** `onDone`: after showing a valid coordinate, e.g. to close the md popover that holds this card; `fluid`: fill the parent (phone drawer) instead of 300 px */
export default function CoordinatesCard({ mapRef, onDone, fluid }: { mapRef: React.RefObject<MapRef | null>; onDone?: () => void; fluid?: boolean }) {

    const [inputValue, setInputValue] = useState("");
    // Shown under the field until the next edit (no toast: it belongs to this field)
    const [error, setError] = useState<string | null>(null);
    const errorId = useId();
    const empty = inputValue.trim() === "";

    function goToInput(raw: string) {
        if (raw.trim() === "") return;

        const result = parseToWGS84(raw);
        if (!result) {
            setError("Kon de coördinaat niet herkennen. Probeer een ander formaat.");
            return;
        }

        const { lng, lat } = result;
        if (!isInNetherlands(lng, lat)) {
            setError("De opgegeven coördinaat ligt buiten Nederland.");
            return;
        }

        mapRef.current?.flyTo({
            center: [lng, lat],
            zoom: 14,
        });

        mapRef.current?.markPoint({ lng, lat } as LngLat, { focus: activatedByKeyboard() });
        setError(null);
        onDone?.();
    }

    function onChange(event: React.ChangeEvent<HTMLInputElement>) {
        setInputValue(event.currentTarget.value);
        setError(null);
    }

    function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        goToInput(inputValue);
    }

    return (
        <div className={cn("relative", fluid ? "w-full" : "w-[300px]")}>
            <form
                onSubmit={onSubmit}
                className={cn(
                    MAP_TILE,
                    // isolate: the Bekijk button's phone hit area stays above the tile's background. Focus: the 3px ring
                    // of the search rows (SearchCard); an error keeps a red ring, 3px while focused
                    "isolate flex h-11 w-full items-center gap-2.5 rounded-(--radius-tile) px-1.5 ring-ring transition-shadow duration-150 focus-within:ring-[3px]",
                    error && "ring-2 ring-destructive",
                )}
            >
                <span className={cn(MAP_CHIP, "text-muted-foreground")}><CrosshairIcon/></span>
                <input
                    aria-label="Coördinaat"
                    aria-invalid={!!error || undefined}
                    aria-describedby={error ? errorId : undefined}
                    placeholder="Zoek op coördinaat…"
                    // Coordinates, not words: no autofill, spelling marks, capitals; the keyboard's enter key says search
                    autoComplete="off"
                    spellCheck={false}
                    autoCapitalize="off"
                    enterKeyHint="search"
                    onChange={onChange}
                    value={inputValue}
                    className="min-w-0 flex-1 bg-transparent text-base outline-none desk:text-sm placeholder:text-muted-foreground"
                />
                <button
                    type="submit"
                    disabled={empty}
                    className={cn(COARSE_HIT_AREA, "h-8 shrink-0 rounded-(--radius-inner) bg-primary-container px-3 text-body font-semibold text-on-primary-container transition-[background-color,opacity] hover:bg-[color-mix(in_oklab,var(--on-primary-container)_10%,var(--primary-container))] focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-primary-container")}
                >
                    Bekijk
                </button>
            </form>
            {/* Floats under the field (doesn't push the top row) with the tiles' shadow, which a height reveal would clip */}
            <AnimatePresence>
                {error && (
                    <motion.p
                        key={error}
                        id={errorId}
                        role="alert"
                        initial={{opacity: 0, y: -4}}
                        animate={{opacity: 1, y: 0}}
                        exit={{opacity: 0, y: -4}}
                        transition={SWAP_TRANSITION}
                        className={cn(MAP_TILE, "absolute inset-x-0 top-full mt-2 rounded-xl px-3 py-2 text-xs font-medium text-destructive-text")}
                    >
                        {error}
                    </motion.p>
                )}
            </AnimatePresence>
        </div>
    );
}
