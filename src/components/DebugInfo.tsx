import { useAppConfig } from '@/hooks/app-config.hook';
import { Button } from './ui/button';
import { DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';

export default function DebugInfo() {
  const BUILD_TIME = import.meta.env.BUILD_TIME;
  const VERSION = import.meta.env.VERSION;

  const API_BASE_URL = import.meta.env.API_BASE_URL;
  const { huntStart, huntEnd, homeTeamApiId, vehicleGroups } = useAppConfig();
  const formatTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString('nl-NL') : '–');

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Debug informatie</DialogTitle>
        <DialogDescription>Informatie voor ontwikkelaars</DialogDescription>
      </DialogHeader>

      <div>
        <h1 className="font-semibold">Applicatie-informatie</h1>
        <p>Versie: {VERSION}</p>
        <p>Build tijd: {new Date(BUILD_TIME).toLocaleString('nl-NL')}</p>
      </div>

      <div>
        <h1 className="font-semibold">Configuratie</h1>
        <p>API base URL: {API_BASE_URL}</p>
        <p>Hunt start: {formatTime(huntStart)}</p>
        <p>Hunt einde: {formatTime(huntEnd)}</p>
        <p>Thuisbasis API ID: {homeTeamApiId ?? '–'}</p>
        <p>Traccar-groepen: {JSON.stringify(vehicleGroups)}</p>
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button>Sluiten</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  );
}
