import { useState } from 'react';
import { isAxiosError } from 'axios';
import { CopyIcon, ExternalLinkIcon, MapPinIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAdmin } from '@/hooks/admin.hook';
import { useDevices } from '@/hooks/devices.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { formatCoordinates, googleMapsUrl, hunterRows, vehicleGroupIdsFromEnv, type HunterRow } from '@/lib/hunters';
import { formatAccuracy, formatBattery, formatLastUpdate, formatSpeed, isVehicle, VEHICLE_OPTIONS } from '@/lib/tracker';
import { cn } from '@/lib/utils';

const GROUPS = vehicleGroupIdsFromEnv(import.meta.env);
const CLOCK_TICK_MS = 15_000;

type Filter = 'active' | 'all';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-sm tabular-nums">{value}</span>
    </div>
  );
}

function HunterCard({ row, now, onShowOnMap }: { row: HunterRow; now: number; onShowOnMap: (lng: number, lat: number) => void }) {
  const { setDeviceVehicle } = useAdmin();
  const [saving, setSaving] = useState(false);
  const { device, position, user } = row;

  async function changeVehicle(value: string) {
    if (!isVehicle(value)) return;
    setSaving(true);
    try {
      await setDeviceVehicle(device.id, value);
      toast.success(`Voertuig van ${device.name} aangepast`);
    } catch (error) {
      const message = isAxiosError(error) ? (error.response?.data?.message ?? error.response?.data?.errors?.[0]?.msg) : undefined;
      toast.error('Voertuig aanpassen is mislukt', { description: message ?? 'Probeer het opnieuw.' });
    } finally {
      setSaving(false);
    }
  }

  async function copyCoordinates(lat: number, lng: number) {
    try {
      await navigator.clipboard.writeText(formatCoordinates(lat, lng));
      toast('Coördinaten gekopieerd');
    } catch {
      toast.error('Kopiëren mislukt');
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('size-2.5 shrink-0 rounded-full', row.active ? 'bg-green-500' : 'bg-muted-foreground/40')} aria-label={row.active ? 'Actief' : 'Niet actief'} />
            <span className="truncate font-medium">{device.name}</span>
          </div>
          <p className="truncate text-xs text-muted-foreground">{user && user.name !== device.name ? `Gebruiker: ${user.name}` : user ? 'Via Mijn tracker' : 'Geen gekoppelde gebruiker'}</p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{formatLastUpdate(row.lastUpdate, now)}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Snelheid" value={formatSpeed(row.speedKmh)} />
        <Stat label="Batterij" value={formatBattery(row.batteryPercent)} />
        <Stat label="Nauwkeurigheid" value={formatAccuracy(row.accuracyM)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={row.vehicle ?? ''} onValueChange={changeVehicle} disabled={saving}>
          <SelectTrigger size="sm" className="w-32" aria-label="Voertuig">
            <SelectValue placeholder="Voertuig" />
          </SelectTrigger>
          <SelectContent>
            {VEHICLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {position ? (
          <>
            <Button variant="outline" size="sm" onClick={() => onShowOnMap(position.longitude, position.latitude)}>
              <MapPinIcon data-icon="inline-start" />
              Op kaart
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={googleMapsUrl(position.latitude, position.longitude)} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon data-icon="inline-start" />
                Google Maps
              </a>
            </Button>
            <Button variant="ghost" size="sm" className="font-mono text-xs" onClick={() => copyCoordinates(position.latitude, position.longitude)}>
              {formatCoordinates(position.latitude, position.longitude)}
              <CopyIcon data-icon="inline-end" />
            </Button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">Nog geen locatie ontvangen</span>
        )}
      </div>
    </div>
  );
}

/** "Hunters" tab of the Beheer dialog: every Traccar device with live stats, location links and the vehicle. */
export default function HuntersPanel({ onShowOnMap }: { onShowOnMap: (lng: number, lat: number) => void }) {
  const { devices, positions, isLoading } = useDevices();
  const { users } = useAdmin();
  const [filter, setFilter] = useState<Filter>('active');
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), CLOCK_TICK_MS);

  const rows = hunterRows(devices, positions, users, GROUPS, now);
  const activeCount = rows.filter((row) => row.active).length;
  const shown = filter === 'active' ? rows.filter((row) => row.active) : rows;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <ToggleGroup type="single" variant="outline" size="sm" value={filter} onValueChange={(value) => value && setFilter(value as Filter)}>
          <ToggleGroupItem value="active">Actief ({activeCount})</ToggleGroupItem>
          <ToggleGroupItem value="all">Alle ({rows.length})</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && <p className="text-sm text-muted-foreground">Laden...</p>}
        {!isLoading && shown.length === 0 && (
          <p className="text-sm text-muted-foreground">{filter === 'active' ? 'Niemand heeft de afgelopen 5 minuten een locatie gestuurd.' : 'Er zijn nog geen trackers.'}</p>
        )}
        <div className="grid gap-2 md:grid-cols-2">
          {shown.map((row) => (
            <HunterCard key={row.device.id} row={row} now={now} onShowOnMap={onShowOnMap} />
          ))}
        </div>
      </div>
    </div>
  );
}
