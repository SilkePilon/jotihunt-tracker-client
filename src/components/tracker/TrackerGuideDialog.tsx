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
import ResponsiveDialog from '@/components/ResponsiveDialog';
import { useIsMobile } from '@/hooks/media.hook';
import { DIALOG_SHELL } from '@/lib/dialog-shell';
import { cn } from '@/lib/utils';
import { TRACCAR_APP_STORE_URL, TRACCAR_PLAY_STORE_URL } from '@/lib/tracker';
import type { TrackerMe } from '@/types/Tracker';
import TrackerQrCode from './TrackerQrCode';

type ConfiguredTracker = Extract<TrackerMe, { configured: true }>;

function Step({ number, icon: Icon, title, children }: { number: number; icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-container text-xs font-semibold text-on-primary-container">
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
  // Phones skip the QR step: the connect button opens the app directly
  const firstCommonStep = isMobile ? 3 : 4;

  return (
    // Phones: the bottom drawer like the other dialogs (safe areas, Back closes it); desktop: the card dialog
    <ResponsiveDialog
      open={open}
      onClose={() => onOpenChange(false)}
      title="Je telefoon koppelen"
      description="Zo deelt je telefoon zijn locatie met het team. Dit hoef je maar één keer te doen."
      compact
      className={cn(DIALOG_SHELL, 'bg-card sm:max-w-md')}
      drawerClassName="bg-card"
    >
      {/* The steps scroll on short screens; the 4px inset keeps the buttons' focus rings inside the clip */}
      <div className="-m-1 min-h-0 flex-1 overflow-y-auto overscroll-contain p-1" data-tracker-guide>
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
          {isMobile ? (
            <Step number={2} icon={SmartphoneIcon} title="Tik op de knop om de app te openen met de juiste instellingen.">
              <Button asChild size="sm" className="w-full">
                <a href={status.deepLink}>
                  <SmartphoneIcon />
                  Verbinden met Traccar-app
                </a>
              </Button>
            </Step>
          ) : (
            <>
              <Step number={2} icon={ScanQrCodeIcon} title="Open de app en tik op het QR-icoon (instellingen → QR-code scannen)." />
              <Step number={3} icon={QrCodeIcon} title="Scan deze QR-code.">
                <div className="flex justify-center">
                  <TrackerQrCode value={status.qrUrl} size={160} />
                </div>
              </Step>
            </>
          )}
          <Step
            number={firstCommonStep}
            icon={MapPinIcon}
            title='Geef locatie-toestemming "Altijd toestaan" en zet batterijbesparing voor Traccar uit.'
          />
          <Step number={firstCommonStep + 1} icon={ToggleRightIcon} title='Zet de schakelaar "Continu volgen" (Service status) aan.' />
          <Step number={firstCommonStep + 2} icon={CircleCheckIcon} title='Wacht tot hieronder "Verbonden" verschijnt.'>
            <div
              className="flex items-center gap-2 rounded-2xl bg-beheer-row px-3 py-2 text-sm"
              data-tracker-live-status={status.connected ? 'connected' : 'waiting'}
            >
              {status.connected ? (
                <>
                  <CircleCheckIcon className="size-4 text-fox-ok" />
                  <span className="font-medium text-fox-ok">Verbonden</span>
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
      </div>
    </ResponsiveDialog>
  );
}
