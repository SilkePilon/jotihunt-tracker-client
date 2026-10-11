import { useState } from 'react';
import { DownloadIcon, Loader2Icon, QrCodeIcon, RefreshCwIcon, SmartphoneIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/media.hook';
import { useAppRelease, usePairingCode } from '@/hooks/app-pairing.hook';
import useInterval from '@/hooks/utils/interval.hook';
import { absoluteUrl, buildPairingUrl, formatCountdown, formatPairingCode, secondsLeft } from '@/lib/app-pairing';
import TrackerQrCode from './TrackerQrCode';

const apiBase = import.meta.env.API_BASE_URL;

/** Android app: download link and a one-time pairing QR (5 minutes). */
export default function AppPairingPanel() {
  const isMobile = useIsMobile();
  const { release } = useAppRelease();
  const { pairing, creating, failed, create } = usePairingCode();
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), pairing && Date.parse(pairing.expiresAt) > now ? 1000 : null);

  const left = pairing ? secondsLeft(pairing.expiresAt, now) : 0;
  const pairingUrl = pairing ? buildPairingUrl(apiBase, pairing.code, window.location.origin) : '';

  return (
    <div className="flex w-full flex-col items-center gap-2" data-app-pairing>
      {release && (
        <Button asChild variant={pairing ? 'outline' : 'default'} className="w-full">
          <a href={absoluteUrl(apiBase, release.url, window.location.origin)} download>
            <DownloadIcon />
            Download de app ({release.versionName})
          </a>
        </Button>
      )}
      {release === null && <p className="text-center text-xs text-muted-foreground">De Android-app is nog niet beschikbaar.</p>}

      {pairing && left > 0 ? (
        <>
          {isMobile ? (
            <Button asChild className="w-full">
              <a href={pairingUrl}>
                <SmartphoneIcon />
                Open in de Jotihunt-app
              </a>
            </Button>
          ) : (
            <TrackerQrCode value={pairingUrl} label="QR-code om de Jotihunt-app te koppelen" />
          )}
          <p className="text-center text-xs text-muted-foreground">
            {isMobile ? 'Of typ de code in de app: ' : 'Scan met de Jotihunt-app, of typ de code: '}
            <span className="font-mono font-semibold whitespace-nowrap text-foreground">{formatPairingCode(pairing.code)}</span>
          </p>
          <p className="text-xs tabular-nums text-muted-foreground">Nog {formatCountdown(left)} geldig</p>
        </>
      ) : (
        <Button variant={release ? 'outline' : 'default'} className="w-full" disabled={creating} onClick={() => void create()}>
          {creating ? <Loader2Icon className="animate-spin" /> : pairing ? <RefreshCwIcon /> : <QrCodeIcon />}
          {pairing ? 'Nieuwe code' : 'Koppel de app'}
        </Button>
      )}
      {failed && <p className="text-xs font-medium text-destructive">Code maken is mislukt, probeer het opnieuw.</p>}
    </div>
  );
}
