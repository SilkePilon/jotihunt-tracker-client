import {useDevices} from "@/hooks/devices.hook.ts";
import {filterActiveDevices} from "@/lib/utils.ts";
import {Badge} from "@/components/ui/badge.tsx";
import {MapPinIcon} from "lucide-react";
import PropTypes, {InferProps} from "prop-types";
import {MapRef} from "@/components/Map.tsx";
import {Device} from "@/types/Device.ts";
import useSidebarStore from "@/stores/sidebar.store.ts";

export default function ActiveDevices({mapRef, showLabel = true}: InferProps<typeof ActiveDevices.propTypes>) {

    const {devices, positions} = useDevices();
    const activeDevices = filterActiveDevices(devices);
    const setSheetSnap = useSidebarStore((state) => state.setSheetSnap);

    /**
     * Fly to the device on the map and, on mobile, collapse the sheet so the map is visible.
     * @param device The device to fly to.
     */
    function flyToDevice(device: Device) {
        if (mapRef.current) {
            const position = positions?.find((pos) => pos.deviceId === device.id);
            if (position) {
                mapRef.current.flyTo({
                    center: [position.longitude, position.latitude],
                    zoom: 15,
                    essential: true,
                });
            }
        }
        setSheetSnap('peek');
    }

    return (
      <div className={'flex flex-wrap gap-2 items-center'}>
        {showLabel && <p className={'text-sm font-semibold text-foreground'}>Actieve hunters:</p>}
        {(!activeDevices || activeDevices?.length <= 0) && (
          <Badge variant={'destructive'}>
          Niemand
          </Badge>
        )}
        {activeDevices?.map((device) => (
          <button key={device.id} type="button" onClick={() => flyToDevice(device)}>
            <Badge className={'hover:bg-background cursor-pointer flex gap-1'} variant={'secondary'}>
              <MapPinIcon className={'w-4 h-4'} /> {device.name}
            </Badge>
          </button>
        ))}
      </div>
    );
}

ActiveDevices.propTypes = {
    mapRef: PropTypes.object.isRequired as PropTypes.Validator<React.RefObject<MapRef | null>>,
    showLabel: PropTypes.bool,
};
