import { useState, type RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { CarIcon, EllipsisIcon, ExternalLinkIcon, LocateFixedIcon } from 'lucide-react';
import type { MapRef } from '@/components/Map';
import Reveal from '@/components/motion/Reveal';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAdmin } from '@/hooks/admin.hook';
import { useDevices } from '@/hooks/devices.hook';
import { useIsMobile } from '@/hooks/media.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { googleMapsUrl, hunterMeta, hunterRows, vehicleGroupIdsFromEnv, type HunterRow } from '@/lib/hunters';
import { SWAP } from '@/lib/motion';
import { isVehicle, VEHICLE_OPTIONS } from '@/lib/tracker';
import useAdminStore from '@/stores/admin.store';
import useSidebarStore from '@/stores/sidebar.store';
import { BeheerGroup, BeheerPane, BeheerRow, BeheerSkeleton } from './BeheerLayout';

const GROUPS = vehicleGroupIdsFromEnv(import.meta.env);
const CLOCK_TICK_MS = 15_000;
/** The pane's flex gap (gap-7), so a group folding away doesn't leave a gap behind */
const GROUP_GAP = 28;

type ShowOnMap = (lng: number, lat: number) => void;

/** Beheer → Hunters: every Traccar device, live ones first, each with a ⋯ menu (vehicle, map, Google Maps). */
export default function HuntersPane({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const isMobile = useIsMobile();
  const { devices, positions, isLoading } = useDevices();
  const { users } = useAdmin();
  const close = useAdminStore((state) => state.close);
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), CLOCK_TICK_MS);

  const rows = hunterRows(devices, positions, users, GROUPS, now);
  const live = rows.filter((row) => row.active);
  const notLive = rows.filter((row) => !row.active);

  function showOnMap(lng: number, lat: number) {
    close();
    if (isMobile) useSidebarStore.getState().setSheetSnap('peek');
    mapRef.current?.flyTo({ center: [lng, lat], duration: 2000, zoom: 16 });
  }

  const row = (hunter: HunterRow) => (
    <BeheerRow key={hunter.device.id} title={hunter.device.name} meta={hunterMeta(hunter, now) || undefined}>
      <HunterMenu row={hunter} onShowOnMap={showOnMap} />
    </BeheerRow>
  );

  return (
    <BeheerPane title="Hunters" description={isLoading ? 'Laden…' : `${rows.length} trackers, ${live.length} live.`}>
      <AnimatePresence mode="wait" initial={false}>
        {isLoading ? (
          <motion.div key="loading" {...SWAP}>
            <BeheerSkeleton groups={2} />
          </motion.div>
        ) : (
          <motion.div key="content" className="flex flex-col gap-7" {...SWAP}>
            <Reveal gap={GROUP_GAP}>
              {rows.length === 0 && (
                <div className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">Er zijn nog geen trackers.</div>
              )}
            </Reveal>
            <Reveal gap={GROUP_GAP}>
              {live.length > 0 && (
                <BeheerGroup title="Live">
                  <AnimatePresence initial={false}>{live.map(row)}</AnimatePresence>
                </BeheerGroup>
              )}
            </Reveal>
            <Reveal gap={GROUP_GAP}>
              {notLive.length > 0 && (
                <BeheerGroup title="Niet live">
                  <AnimatePresence initial={false}>{notLive.map(row)}</AnimatePresence>
                </BeheerGroup>
              )}
            </Reveal>
          </motion.div>
        )}
      </AnimatePresence>
    </BeheerPane>
  );
}

/** ⋯ for one hunter: vehicle (moves the Traccar device to the vehicle's group, i.e. its map icon), Op kaart, Google Maps. */
function HunterMenu({ row, onShowOnMap }: { row: HunterRow; onShowOnMap: ShowOnMap }) {
  const { setDeviceVehicle } = useAdmin();
  const [saving, setSaving] = useState(false);
  const position = row.position;
  const name = row.device.name;

  async function changeVehicle(value: string) {
    if (!isVehicle(value) || value === row.vehicle) return;
    setSaving(true);
    try {
      await setDeviceVehicle(row.device.id, value);
      toast.success(`Voertuig van ${name} aangepast`);
    } catch (error) {
      toast.error('Voertuig aanpassen is mislukt', { description: apiErrorMessage(error, 'Probeer het opnieuw.') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Opties voor ${name}`}>
          <EllipsisIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={saving}>
            <CarIcon />
            Voertuig
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={row.vehicle ?? ''} onValueChange={(value) => void changeVehicle(value)}>
                {VEHICLE_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuItem disabled={!position} onSelect={() => position && onShowOnMap(position.longitude, position.latitude)}>
          <LocateFixedIcon />
          Op kaart
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!position} onSelect={() => position && window.open(googleMapsUrl(position.latitude, position.longitude), '_blank', 'noopener')}>
          <ExternalLinkIcon />
          Google Maps
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
