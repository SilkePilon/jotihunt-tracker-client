import MapPopup from './MapPopup';
import MarkerRegistration from './MarkerRegistration';
import GoogleMapsButton from './GoogleMapsButton';
import {Marker} from "react-map-gl/maplibre";
import {Button} from "@/components/ui/button.tsx";
import {LightbulbIcon} from "lucide-react";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip.tsx";
import {useHintFormBridge} from "@/hooks/hint-bridge.hook.ts";
import CopyButton from "@/components/CopyButton";
import {toRD} from "@/lib/rd";
import useSidebarStore from "@/stores/sidebar.store.ts";

export default function PickedLocationPopup({lat, lng, onClose}: { lat: number; lng: number; onClose: () => void }) {

    const setCoords = useHintFormBridge((s) => s.setCoords);
    const openSection = useSidebarStore((s) => s.openSection);
    const setSheetSnap = useSidebarStore((s) => s.setSheetSnap);

    const rdMetres = toRD(lng, lat);
    const rd = {x: rdMetres.x.toFixed(0), y: rdMetres.y.toFixed(0)};
    const copiedMessage = "Coördinaten gekopieerd naar klembord!";

    function setHintCoords() {
        setCoords(rd.x, rd.y);
        // The hint entry section is collapsed by default, so make sure it's
        // actually visible (and scrolled into view on mobile) before the form fills in.
        openSection('hintEntry');
        setSheetSnap('full');
    }

    return (
        <>
            <Marker
                longitude={lng || 0}
                latitude={lat || 0}
                anchor="center">
                <div className={"bg-blue-500 block w-4 h-4 rounded-full border border-white animate-pulse"}></div>
            </Marker>
            <MapPopup onClose={onClose} longitude={lng || 0} latitude={lat || 0} offset={{bottom: [0, -15]}}>
                <div className="mr-6 flex flex-col gap-2 w-full">
                    <div>
                        <h2 className="font-semibold mb-2">Gekozen locatie</h2>
                        <div className={"flex flex-col gap-2"}>
                            <hr/>
                            <div className={"flex gap-3 justify-between"}>
                                <div className={"flex flex-col"}>
                                    <p>Breedtegraad: {lat.toFixed(7)}</p>
                                    <p>Lengtegraad: {lng.toFixed(7)}</p>
                                </div>
                                <CopyButton value={`${lat.toFixed(7)}, ${lng.toFixed(7)}`} label="Coördinaten"
                                            successMessage={copiedMessage} size="icon"/>
                            </div>
                            <hr/>
                            <div className={"flex gap-3 justify-between"}>
                                <div className={"flex flex-col"}>
                                    <p>RD-x: {rd.x}</p>
                                    <p>RD-y: {rd.y}</p>
                                </div>
                                <div className={"flex gap-2"}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant={"outline"} size={"icon"}
                                                    onClick={setHintCoords}><LightbulbIcon/></Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Plaats coördinaten in hint registratie.
                                        </TooltipContent>
                                    </Tooltip>
                                    <CopyButton value={`${rd.x}, ${rd.y}`} label="RD-coördinaten"
                                                successMessage={copiedMessage} size="icon"/>
                                </div>
                            </div>
                            <hr/>
                        </div>
                    </div>
                    <GoogleMapsButton lat={lat} lng={lng}/>
                    <MarkerRegistration lat={lat} lng={lng}/>
                </div>

            </MapPopup>
        </>
    );
}
