import { AnimatePresence, motion } from 'motion/react';
import { ChevronDownIcon, Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TRIGGER_OPEN } from '@/lib/menu-styles';
import { SWAP } from '@/lib/motion';
import { isVehicle, VEHICLE_ICONS, VEHICLE_OPTIONS } from '@/lib/tracker';
import { cn } from '@/lib/utils';
import type { Vehicle } from '@/types/Tracker';

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
        <Button variant="secondary" size="sm" className={cn('rounded-full', TRIGGER_OPEN)} aria-label={`Voertuig: ${current.label}. Wijzigen`}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={saving ? 'saving' : current.value} {...SWAP} className="flex items-center gap-1.5">
              {saving ? <Loader2Icon className="animate-spin" /> : <Icon />}
              {current.phrase}
            </motion.span>
          </AnimatePresence>
          <ChevronDownIcon data-chevron className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-52">
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
