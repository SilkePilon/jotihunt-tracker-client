import { ReactNode } from 'react';
import {
  CircleCheckIcon,
  DownloadIcon,
  LoaderCircleIcon,
  MapPinIcon,
  QrCodeIcon,
  ScanQrCodeIcon,
  SmartphoneIcon,
  ToggleRightIcon,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/media.hook';
import { TRACCAR_APP_STORE_URL, TRACCAR_PLAY_STORE_URL } from '@/lib/tracker';
import type { TrackerMe } from '@/types/Tracker';
import TrackerQrCode from './TrackerQrCode';

type ConfiguredTracker = Extract<TrackerMe, { configured: true }>;

function Step({ number, icon: Icon, title, children }: { number: number; icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {number}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
        <p className="flex items-start gap-1.5 text-sm">
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>{title}</span>
        </p>
        {children}
      </div>
    </li>
  );
}

interface TrackerGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: ConfiguredTracker;
}

/** Step-by-step guide for connecting the phone, with the same QR code and a live connection status. */
export default function TrackerGuideDialog({ open, onOpenChange, status }: TrackerGuideDialogProps) {
  const isMobile = useIsMobile();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md" data-tracker-guide>
        <DialogHeader>
          <DialogTitle>Je telefoon koppelen</DialogTitle>
          <DialogDescription>Zo deelt je telefoon zijn locatie met het team. Dit hoef je maar één keer te doen.</DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-4">
          <Step number={1} icon={DownloadIcon} title='Installeer de app "Traccar Client".'>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <a href={TRACCAR_PLAY_STORE_URL} target="_blank" rel="noreferrer">
                  Google Play
                </a>
              </Button>
              <Button asChild variant="outline" size="sm" className="flex-1">
                <a href={TRACCAR_APP_STORE_URL} target="_blank" rel="noreferrer">
                  App Store
                </a>
              </Button>
            </div>
          </Step>
          <Step number={2} icon={ScanQrCodeIcon} title="Open de app en tik op het QR-icoon (instellingen → QR-code scannen).">
            {isMobile && (
              <>
                <p className="text-xs text-muted-foreground">Open je deze pagina op je telefoon? Tik dan op deze knop in plaats van te scannen:</p>
                <Button asChild size="sm" className="w-full">
                  <a href={status.deepLink}>
                    <SmartphoneIcon />
                    Open in Traccar-app
                  </a>
                </Button>
              </>
            )}
          </Step>
          <Step number={3} icon={QrCodeIcon} title="Scan deze QR-code.">
            <div className="flex justify-center">
              <TrackerQrCode value={status.qrUrl} size={160} />
            </div>
          </Step>
          <Step
            number={4}
            icon={MapPinIcon}
            title='Geef locatie-toestemming "Altijd toestaan" en zet batterijbesparing voor Traccar uit.'
          />
          <Step number={5} icon={ToggleRightIcon} title='Zet de schakelaar "Continu volgen" (Service status) aan.' />
          <Step number={6} icon={CircleCheckIcon} title='Wacht tot hieronder "Verbonden" verschijnt.'>
            <div
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              data-tracker-live-status={status.connected ? 'connected' : 'waiting'}
            >
              {status.connected ? (
                <>
                  <CircleCheckIcon className="size-4 text-green-500" />
                  <span className="font-medium text-green-600 dark:text-green-500">Verbonden</span>
                </>
              ) : (
                <>
                  <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">Wachten op de eerste locatie…</span>
                </>
              )}
            </div>
          </Step>
        </ol>
      </DialogContent>
    </Dialog>
  );
}
