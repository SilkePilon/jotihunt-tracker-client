import { useState } from 'react';
import { isAxiosError } from 'axios';
import { ArrowLeftIcon, CopyIcon, ExternalLinkIcon, LocateFixedIcon, SearchIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAdmin } from '@/hooks/admin.hook';
import { useDevices } from '@/hooks/devices.hook';
import { useIsMobile } from '@/hooks/media.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { formatCoordinates, googleMapsUrl, hunterRows, vehicleGroupIdsFromEnv, type HunterRow } from '@/lib/hunters';
import { formatAccuracy, formatBattery, formatLastUpdate, formatSpeed, isVehicle, VEHICLE_OPTIONS } from '@/lib/tracker';
import { cn } from '@/lib/utils';

const GROUPS = vehicleGroupIdsFromEnv(import.meta.env);
const CLOCK_TICK_MS = 15_000;
const LOW_BATTERY_PERCENT = 20;

type Filter = 'active' | 'all';
type ShowOnMap = (lng: number, lat: number) => void;

function StatusDot({ active }: { active: boolean }) {
  return <span className={cn('inline-block size-2 shrink-0 rounded-full', active ? 'bg-green-500' : 'bg-muted-foreground/30')} aria-label={active ? 'Actief' : 'Niet actief'} />;
}

function Battery({ percent }: { percent?: number }) {
  return <span className={cn(percent !== undefined && percent < LOW_BATTERY_PERCENT && 'font-medium text-destructive')}>{formatBattery(percent)}</span>;
}

/** Vehicle select; saving moves the Traccar device to the vehicle's group (map icon). */
function VehicleSelect({ row }: { row: HunterRow }) {
  const { setDeviceVehicle } = useAdmin();
  const [saving, setSaving] = useState(false);

  async function change(value: string) {
    if (!isVehicle(value)) return;
    setSaving(true);
    try {
      await setDeviceVehicle(row.device.id, value);
      toast.success(`Voertuig van ${row.device.name} aangepast`);
    } catch (error) {
      const message = isAxiosError(error) ? (error.response?.data?.message ?? error.response?.data?.errors?.[0]?.msg) : undefined;
      toast.error('Voertuig aanpassen is mislukt', { description: message ?? 'Probeer het opnieuw.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Select value={row.vehicle ?? ''} onValueChange={change} disabled={saving}>
      <SelectTrigger size="sm" className="w-28" aria-label={`Voertuig van ${row.device.name}`}>
        <SelectValue placeholder="Kies…" />
      </SelectTrigger>
      <SelectContent>
        {VEHICLE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function IconAction({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function LocationActions({ row, onShowOnMap }: { row: HunterRow; onShowOnMap: ShowOnMap }) {
  const position = row.position;
  if (!position) return <span className="text-xs text-muted-foreground">Geen locatie</span>;
  return (
    <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
      <IconAction label="Op kaart">
        <Button variant="outline" size="icon-sm" aria-label="Op kaart" onClick={() => onShowOnMap(position.longitude, position.latitude)}>
          <LocateFixedIcon />
        </Button>
      </IconAction>
      <IconAction label="Google Maps">
        <Button variant="outline" size="icon-sm" aria-label="Open in Google Maps" asChild>
          <a href={googleMapsUrl(position.latitude, position.longitude)} target="_blank" rel="noopener noreferrer">
            <ExternalLinkIcon />
          </a>
        </Button>
      </IconAction>
    </div>
  );
}

function subtitle(row: HunterRow): string {
  if (!row.user) return 'Geen gekoppelde gebruiker';
  return row.user.email;
}

/** All details of one hunter (phones: after tapping a row; desktop: after clicking the name). */
function HunterDetail({ row, now, onBack, onShowOnMap }: { row: HunterRow; now: number; onBack: () => void; onShowOnMap: ShowOnMap }) {
  const position = row.position;

  async function copyCoordinates(lat: number, lng: number) {
    try {
      await navigator.clipboard.writeText(formatCoordinates(lat, lng));
      toast('Coördinaten gekopieerd');
    } catch {
      toast.error('Kopiëren mislukt');
    }
  }

  const facts: [string, React.ReactNode][] = [
    ['Laatste update', formatLastUpdate(row.lastUpdate, now)],
    ['Snelheid', formatSpeed(row.speedKmh)],
    ['Batterij', <Battery key="battery" percent={row.batteryPercent} />],
    ['Nauwkeurigheid', formatAccuracy(row.accuracyM)],
    ['Gebruiker', row.user ? `${row.user.name} (${row.user.email})` : '–'],
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start" />
          Terug
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <StatusDot active={row.active} />
        <span className="text-lg font-semibold">{row.device.name}</span>
        <Badge variant={row.active ? 'default' : 'secondary'} className="ml-auto">
          {row.active ? 'Actief' : 'Niet actief'}
        </Badge>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        <dt className="self-center text-muted-foreground">Voertuig</dt>
        <dd>
          <VehicleSelect row={row} />
        </dd>
      </dl>
      {position ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onShowOnMap(position.longitude, position.latitude)}>
            <LocateFixedIcon data-icon="inline-start" />
            Op kaart
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={googleMapsUrl(position.latitude, position.longitude)} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon data-icon="inline-start" />
              Google Maps
            </a>
          </Button>
          <Button variant="ghost" size="sm" className="font-mono" onClick={() => copyCoordinates(position.latitude, position.longitude)}>
            {formatCoordinates(position.latitude, position.longitude)}
            <CopyIcon data-icon="inline-end" />
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nog geen locatie ontvangen.</p>
      )}
    </div>
  );
}

/** Settings → Admin tools → Hunters: every Traccar device in a table with live stats, vehicle and location actions. */
export default function HuntersPanel({ onShowOnMap }: { onShowOnMap: ShowOnMap }) {
  const isMobile = useIsMobile();
  const { devices, positions, isLoading } = useDevices();
  const { users } = useAdmin();
  const [filter, setFilter] = useState<Filter>('active');
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), CLOCK_TICK_MS);

  const rows = hunterRows(devices, positions, users, GROUPS, now);
  const detail = detailId === null ? undefined : rows.find((row) => row.device.id === detailId);
  if (detail) return <HunterDetail row={detail} now={now} onBack={() => setDetailId(null)} onShowOnMap={onShowOnMap} />;

  const activeCount = rows.filter((row) => row.active).length;
  const term = search.trim().toLowerCase();
  const shown = rows
    .filter((row) => filter === 'all' || row.active)
    .filter((row) => !term || row.device.name.toLowerCase().includes(term) || row.user?.name.toLowerCase().includes(term) || row.user?.email.toLowerCase().includes(term));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-60">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Zoek hunter…" className="pl-8" />
        </div>
        <ToggleGroup type="single" variant="outline" value={filter} onValueChange={(value) => value && setFilter(value as Filter)}>
          <ToggleGroupItem value="active" className="px-3">
            Actief {activeCount}
          </ToggleGroupItem>
          <ToggleGroupItem value="all" className="px-3">
            Alle {rows.length}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-6" />
              <TableHead>Hunter</TableHead>
              <TableHead className="max-md:hidden">Voertuig</TableHead>
              <TableHead>Laatste update</TableHead>
              <TableHead className="max-md:hidden">Batterij</TableHead>
              <TableHead className="max-md:hidden">Snelheid</TableHead>
              <TableHead className="text-right max-md:hidden">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((row) => (
              <TableRow
                key={row.device.id}
                className="cursor-pointer"
                tabIndex={0}
                onClick={() => setDetailId(row.device.id)}
                onKeyDown={(event) => {
                  if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    setDetailId(row.device.id);
                  }
                }}
              >
                <TableCell>
                  <StatusDot active={row.active} />
                </TableCell>
                <TableCell>
                  <div className="font-medium">{row.device.name}</div>
                  <div className="max-w-36 truncate text-xs text-muted-foreground md:max-w-48">{subtitle(row)}</div>
                </TableCell>
                {/* Stop clicks (also from the portalled select menu, which bubble through React) from opening the details */}
                <TableCell className="max-md:hidden" onClick={(event) => event.stopPropagation()}>
                  <VehicleSelect row={row} />
                </TableCell>
                <TableCell>
                  {formatLastUpdate(row.lastUpdate, now)}
                  {/* Phones: no room for a battery column */}
                  {row.batteryPercent !== undefined && (
                    <div className="text-xs text-muted-foreground md:hidden">
                      Batterij <Battery percent={row.batteryPercent} />
                    </div>
                  )}
                </TableCell>
                <TableCell className="max-md:hidden">
                  <Battery percent={row.batteryPercent} />
                </TableCell>
                <TableCell className="max-md:hidden">{formatSpeed(row.speedKmh)}</TableCell>
                <TableCell className="max-md:hidden">
                  <LocationActions row={row} onShowOnMap={onShowOnMap} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {isLoading && <p className="p-2 text-sm text-muted-foreground">Laden...</p>}
        {!isLoading && shown.length === 0 && (
          <p className="p-2 text-sm text-muted-foreground">
            {term ? 'Geen hunters gevonden.' : filter === 'active' ? 'Niemand heeft de afgelopen 5 minuten een locatie gestuurd.' : 'Er zijn nog geen trackers.'}
          </p>
        )}
        {isMobile && shown.length > 0 && <p className="p-2 text-xs text-muted-foreground">Tik op een hunter voor locatie, voertuig en details.</p>}
      </div>
    </div>
  );
}
