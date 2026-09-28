import { BikeIcon, CarIcon, FootprintsIcon, MotorbikeIcon, type LucideIcon } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { isVehicle, VEHICLE_OPTIONS } from '@/lib/tracker';
import type { Vehicle } from '@/types/Tracker';

const VEHICLE_ICONS: Record<Vehicle, LucideIcon> = {
  walking: FootprintsIcon,
  bike: BikeIcon,
  car: CarIcon,
  motorcycle: MotorbikeIcon,
};

interface VehiclePickerProps {
  value: Vehicle;
  disabled?: boolean;
  onChange: (vehicle: Vehicle) => void;
}

/** Lopend / Fiets / Auto / Motor; the server moves the Traccar device to the matching group. */
export default function VehiclePicker({ value, disabled, onChange }: VehiclePickerProps) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value}
      disabled={disabled}
      aria-label="Voertuig"
      className="w-full"
      onValueChange={(next) => {
        // Radix sends '' when the active item is clicked again: keep the current vehicle
        if (isVehicle(next) && next !== value) onChange(next);
      }}
    >
      {VEHICLE_OPTIONS.map((option) => {
        const Icon = VEHICLE_ICONS[option.value];
        return (
          <ToggleGroupItem key={option.value} value={option.value} aria-label={option.label} className="flex-1 gap-1 px-1.5 text-xs">
            <Icon />
            {option.label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
