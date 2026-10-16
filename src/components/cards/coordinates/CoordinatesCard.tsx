import {SearchIcon} from "lucide-react";
import * as React from "react";
import {MapRef} from "@/components/Map.tsx";
import {useState} from "react";
import {toast} from "sonner";
import type {LngLat} from "maplibre-gl";
import {cn} from "@/lib/utils.ts";
import {parseToWGS84} from "@/lib/coordinates.ts";
import {isInNetherlands} from "@/lib/netherlands.ts";
import {MAP_CHIP, MAP_TILE} from "@/lib/map-chrome.ts";

export default function CoordinatesCard({ mapRef }: { mapRef: React.RefObject<MapRef | null> }) {

    const [inputValue, setInputValue] = useState("");
    const [hasError, setHasError] = useState(false);

    function goToInput(raw: string) {
        if (raw == "") return;

        const result = parseToWGS84(raw);
        if (!result) {
            toast.error("Kon de coördinaat niet herkennen. Probeer een ander formaat.");
            setHasError(true);
            return;
        }

        const { lng, lat } = result;
        if (!isInNetherlands(lng, lat)) {
            toast.error("De opgegeven coördinaat ligt buiten Nederland.");
            setHasError(true);
            return;
        }

        mapRef.current?.flyTo({
            center: [lng, lat],
            zoom: 14,
            essential: true,
        });

        mapRef.current?.markPoint({ lng, lat } as LngLat);
        setHasError(false);
    }

    function onChange(event: React.ChangeEvent<HTMLInputElement>) {
        const value = event.currentTarget.value;
        if (value == "") setHasError(false);
        setInputValue(value);
    }

    function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        goToInput(inputValue);
    }

    return (
        <form
            onSubmit={onSubmit}
            className={cn(
                MAP_TILE,
                "flex h-11 w-[300px] items-center gap-2.5 rounded-[14px] px-1.5 outline-2 outline-transparent transition-[outline-color] duration-150 focus-within:outline-ring/50",
                hasError && "outline-destructive focus-within:outline-destructive",
            )}
        >
            <span className={cn(MAP_CHIP, "text-muted-foreground")}><SearchIcon/></span>
            <input
                aria-label="Coördinaat"
                aria-invalid={hasError || undefined}
                placeholder="Zoek op coördinaat..."
                onChange={onChange}
                value={inputValue}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
                type="submit"
                className="h-8 shrink-0 rounded-[9px] bg-primary-container px-3 text-[13px] font-semibold text-on-primary-container transition-colors hover:bg-[color-mix(in_oklab,var(--on-primary-container)_10%,var(--primary-container))] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
                Bekijk
            </button>
        </form>
    );
}
