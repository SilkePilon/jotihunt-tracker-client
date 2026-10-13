import { BikeIcon, CarIcon, ChevronDownIcon, FootprintsIcon, Loader2Icon, MotorbikeIcon, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { isVehicle, VEHICLE_OPTIONS } from '@/lib/tracker';
import type { Vehicle } from '@/types/Tracker';

const VEHICLE_ICONS: Record<Vehicle, LucideIcon> = {
  walking: FootprintsIcon,
  bike: BikeIcon,
  car: CarIcon,
  motorcycle: MotorbikeIcon,
};

interface VehicleMenuProps {
  value: Vehicle;
  saving: boolean;
  onChange: (vehicle: Vehicle) => void;
}

/** "Op de fiets ▾" pill; the server moves the Traccar device to the matching group. */
export default function VehicleMenu({ value, saving, onChange }: VehicleMenuProps) {
  const current = VEHICLE_OPTIONS.find((option) => option.value === value) ?? VEHICLE_OPTIONS[0];
  const Icon = VEHICLE_ICONS[current.value];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={saving}>
        <Button variant="secondary" size="sm" className="rounded-full" aria-label={`Voertuig: ${current.label}. Wijzigen`}>
          {saving ? <Loader2Icon className="animate-spin" /> : <Icon />}
          {current.phrase}
          <ChevronDownIcon className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            if (isVehicle(next) && next !== value) onChange(next);
          }}
        >
          {VEHICLE_OPTIONS.map((option) => {
            const OptionIcon = VEHICLE_ICONS[option.value];
            return (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                <OptionIcon />
                {option.label}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
