import { useCallback, useMemo, useState } from 'react';
import { Layer, Source, type FillLayerSpecification } from 'react-map-gl/maplibre';
import { useDevices } from '@/hooks/devices.hook';
import carIcon from '@/assets/images/car.svg';
import bicycleIcon from '@/assets/images/bicycle.svg';
import walkingIcon from '@/assets/images/walking.svg';
import motorbikeIcon from '@/assets/images/motorbike.svg';
import phoneIcon from '@/assets/images/phone.svg';
import { vehicleForGroupId, vehicleGroupIdsFromEnv } from '@/lib/hunters';
import { accuracyCircles } from '@/lib/map-layers';
import { isMoreThanFiveMinutesAgo } from '@/lib/utils';
import type { Vehicle } from '@/types/Tracker';
import DeviceMarker from './devices/DeviceMarker';
import DevicePopup from './devices/DevicePopup';

const GROUPS = vehicleGroupIdsFromEnv(import.meta.env);
const VEHICLE_ICONS: Record<Vehicle, string> = { walking: walkingIcon, bike: bicycleIcon, car: carIcon, motorcycle: motorbikeIcon };

/** Icon for a Traccar group: the vehicle's icon, or a phone when the group isn't a configured vehicle */
function iconForGroup(groupId: number): string {
  const vehicle = vehicleForGroupId(groupId, GROUPS);
  return vehicle ? VEHICLE_ICONS[vehicle] : phoneIcon;
}

const ACCURACY_SOURCE = 'device-accuracy';
const ACCURACY_PAINT: FillLayerSpecification['paint'] = {
  'fill-color': 'rgba(66, 135, 245, 0.2)',
  'fill-outline-color': 'rgba(66, 135, 245, 0.5)',
};

export default function Devices() {
  const { positions, devices } = useDevices();
  const [activeDeviceId, setActiveDeviceId] = useState<number>();
  // Derived from the current data so the popup follows the device; device id 0 is valid, hence `!== undefined`
  const activeDevice = activeDeviceId !== undefined ? positions?.find((position) => position.deviceId === activeDeviceId) : undefined;

  /** Device id -> icon for its vehicle group (phone when the group isn't a vehicle) */
  const iconByDevice = useMemo(() => new Map((devices ?? []).map((device) => [device.id, iconForGroup(device.groupId)])), [devices]);
  const circles = useMemo(() => accuracyCircles(positions ?? []), [positions]);

  const selectDevice = useCallback((deviceId: number) => setActiveDeviceId(deviceId), []);
  const closePopup = useCallback(() => setActiveDeviceId(undefined), []);

  return (
    <>
      <Source id={ACCURACY_SOURCE} type="geojson" data={circles}>
        <Layer id="device-accuracy-fill" type="fill" source={ACCURACY_SOURCE} paint={ACCURACY_PAINT} />
      </Source>
      {positions?.map((position) => {
        const stale = isMoreThanFiveMinutesAgo(position.fixTime);
        return (
          <DeviceMarker
            key={position.deviceId}
            deviceId={position.deviceId}
            deviceName={position.deviceName}
            longitude={position.longitude}
            latitude={position.latitude}
            course={position.course}
            fixTime={position.fixTime}
            icon={iconByDevice.get(position.deviceId) ?? phoneIcon}
            moving={position.speed > 0 && !stale}
            stale={stale}
            tooltipsDisabled={activeDevice !== undefined}
            onSelect={selectDevice}
          />
        );
      })}
      {activeDevice && <DevicePopup position={activeDevice} onClose={closePopup} />}
    </>
  );
}
