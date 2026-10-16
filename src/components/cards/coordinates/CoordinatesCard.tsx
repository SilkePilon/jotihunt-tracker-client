import {InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput} from "@/components/ui/input-group.tsx";
import * as React from "react";
import {MapRef} from "@/components/Map.tsx";
import {useState} from "react";
import {toast} from "sonner";
import type {LngLat} from "maplibre-gl";
import {cn} from "@/lib/utils.ts";
import {parseToWGS84} from "@/lib/coordinates.ts";
import {isInNetherlands} from "@/lib/netherlands.ts";

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
        <form className={"bg-background rounded-md"} onSubmit={onSubmit}>
            <InputGroup className={cn("h-9", hasError && "border-red-500")}>
                <InputGroupInput placeholder="Zoek op coördinaat..." onChange={onChange} value={inputValue} />
                <InputGroupAddon align="inline-end">
                    <InputGroupButton type="submit" variant="secondary">Bekijk</InputGroupButton>
                </InputGroupAddon>
            </InputGroup>
        </form>
    );
}
