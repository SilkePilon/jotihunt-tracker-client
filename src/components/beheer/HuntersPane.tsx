import { useState, type RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { ExternalLinkIcon, LocateFixedIcon } from 'lucide-react';
import { useMarkerPalette } from '@/components/layers/marker-icons';
import type { MapRef } from '@/components/Map';
import MarkerGlyph from '@/components/map/popup/MarkerGlyph';
import Reveal from '@/components/motion/Reveal';
import { useAdmin } from '@/hooks/admin.hook';
import { useDevices } from '@/hooks/devices.hook';
import { useIsMobile } from '@/hooks/media.hook';
import { SLOW_CLOCK_TICK_MS, useNow } from '@/hooks/now.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { googleMapsUrl, hunterIcon, hunterMeta, hunterRows, huntersSummary, isLowBattery, vehicleGroupIdsFromEnv, type HunterRow } from '@/lib/hunters';
import { vehicleGlyph } from '@/lib/marker-style';
import { SWAP } from '@/lib/motion';
import { formatBattery, VEHICLE_OPTIONS } from '@/lib/tracker';
import { cn } from '@/lib/utils';
import useAdminStore from '@/stores/admin.store';
import useSidebarStore from '@/stores/sidebar.store';
import type { Vehicle } from '@/types/Tracker';
import { BeheerCard, BeheerExpandableRow, BeheerPane, BeheerRows, BeheerSkeleton } from './BeheerLayout';
import { Pill } from './controls/Pill';
import Segmented, { type SegmentOption } from './controls/Segmented';

const GROUPS = vehicleGroupIdsFromEnv(import.meta.env);
/** The pane's card gap (gap-3.5), so a card folding away doesn't leave a gap behind */
const CARD_GAP = 14;

const VEHICLE_SEGMENTS: SegmentOption<Vehicle>[] = VEHICLE_OPTIONS.map(({ value, label }) => ({
  value,
  label,
  icon: <MarkerGlyph name={vehicleGlyph(value)} />,
}));

type ShowOnMap = (lng: number, lat: number) => void;

/** The map's hunter marker look: the vehicle glyph in the secondary-container circle; grey and dimmed when not live. */
function HunterMarker({ row }: { row: HunterRow }) {
  const palette = useMarkerPalette();
  return (
    <span
      aria-hidden
      className={cn('grid size-9 shrink-0 place-items-center rounded-full transition-opacity duration-300 [&_svg]:size-[19px]', !row.active && 'opacity-60')}
      style={{
        background: row.active ? palette.secondaryContainer : palette.surfaceContainerHighest,
        color: row.active ? palette.onSecondaryContainer : palette.onSurfaceVariant,
      }}
    >
      <MarkerGlyph name={vehicleGlyph(hunterIcon(row))} />
    </span>
  );
}

/** Battery glyph + percentage; red under 20 %. Nothing when unknown. */
function Battery({ percent }: { percent: number | undefined }) {
  if (percent === undefined) return null;
  return (
    <span title="Batterij" className={cn('inline-flex items-center gap-1.5 text-xs font-bold tabular-nums transition-colors', isLowBattery(percent) ? 'text-destructive dark:text-red-300' : 'text-foreground/80')}>
      <span aria-hidden className="relative inline-block h-[11px] w-[22px] rounded-[3px] shadow-[inset_0_0_0_1.5px_currentColor]">
        <span className="absolute inset-y-[2px] left-[2px] rounded-[1px] bg-current transition-[width] duration-300 motion-reduce:transition-none" style={{ width: Math.max(2, (18 * percent) / 100) }} />
      </span>
      {formatBattery(percent)}
    </span>
  );
}

/** Beheer → Hunters (H1): every Traccar device, live ones first; tap for Toon op kaart, Google Maps and the vehicle. */
export default function HuntersPane({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const isMobile = useIsMobile();
  const { devices, positions, isLoading, isError } = useDevices();
  const { users } = useAdmin();
  const close = useAdminStore((state) => state.close);
  const now = useNow(true, SLOW_CLOCK_TICK_MS);

  // A failed poll keeps the last list on screen; only show the error when there's nothing to show
  const view = isLoading ? 'loading' : isError && !devices?.length ? 'error' : 'content';
  const rows = hunterRows(devices, positions, users, GROUPS, now);
  const live = rows.filter((row) => row.active);
  const notLive = rows.filter((row) => !row.active);

  function showOnMap(lng: number, lat: number) {
    close();
    if (isMobile) useSidebarStore.getState().setSheetSnap('peek');
    mapRef.current?.flyTo({ center: [lng, lat], duration: 2000, zoom: 16 });
  }

  const row = (hunter: HunterRow) => (
    <BeheerExpandableRow
      key={hunter.device.id}
      id={String(hunter.device.id)}
      // 12px padding + 36px marker + 12px gap
      indentClassName="pl-[60px]"
      leading={<HunterMarker row={hunter} />}
      title={<span className="truncate">{hunter.device.name}</span>}
      meta={<Reveal>{hunterMeta(hunter, now)}</Reveal>}
      trailing={<Battery percent={hunter.batteryPercent} />}
    >
      <HunterActions row={hunter} onShowOnMap={showOnMap} />
    </BeheerExpandableRow>
  );

  return (
    <BeheerPane title="Hunters" description={view === 'content' ? huntersSummary(rows) : view === 'loading' ? 'Laden…' : undefined}>
      <AnimatePresence mode="wait" initial={false}>
        {view === 'loading' && (
          <motion.div key="loading" {...SWAP}>
            <BeheerSkeleton groups={2} />
          </motion.div>
        )}
        {view === 'error' && (
          <motion.p key="error" className="text-sm text-muted-foreground" {...SWAP}>
            Kan de hunters niet laden.
          </motion.p>
        )}
        {view === 'content' && (
          <motion.div key="content" className="flex flex-col gap-3.5" {...SWAP}>
            <Reveal gap={CARD_GAP}>
              {rows.length === 0 && (
                <BeheerCard>
                  <p className="px-1 text-sm text-muted-foreground">Er zijn nog geen trackers.</p>
                </BeheerCard>
              )}
            </Reveal>
            <Reveal gap={CARD_GAP}>
              {live.length > 0 && (
                <BeheerCard title="Live" count={live.length}>
                  <BeheerRows>{live.map(row)}</BeheerRows>
                </BeheerCard>
              )}
            </Reveal>
            <Reveal gap={CARD_GAP}>
              {notLive.length > 0 && (
                <BeheerCard title="Niet live" count={notLive.length}>
                  <BeheerRows>{notLive.map(row)}</BeheerRows>
                </BeheerCard>
              )}
            </Reveal>
          </motion.div>
        )}
      </AnimatePresence>
    </BeheerPane>
  );
}

/** The unfolded part of a hunter row: Toon op kaart, Google Maps, and the vehicle (moves the Traccar device to the vehicle's group, i.e. its map icon). */
function HunterActions({ row, onShowOnMap }: { row: HunterRow; onShowOnMap: ShowOnMap }) {
  const { setDeviceVehicle } = useAdmin();
  const [saving, setSaving] = useState(false);
  const position = row.position;
  const name = row.device.name;

  async function changeVehicle(value: Vehicle) {
    if (value === row.vehicle) return;
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
    <>
      <Pill disabled={!position} onClick={() => position && onShowOnMap(position.longitude, position.latitude)}>
        <LocateFixedIcon />
        Toon op kaart
      </Pill>
      <Pill disabled={!position} onClick={() => position && window.open(googleMapsUrl(position.latitude, position.longitude), '_blank', 'noopener')}>
        <ExternalLinkIcon />
        Google Maps
      </Pill>
      <Segmented label={`Voertuig van ${name}`} value={row.vehicle} options={VEHICLE_SEGMENTS} onChange={(value) => void changeVehicle(value)} disabled={saving} className="sm:ml-2" />
    </>
  );
}
