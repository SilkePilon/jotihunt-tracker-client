import CopyButton from '@/components/CopyButton';
import TrackerQrCode from '@/components/tracker/TrackerQrCode';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { inviteMeta, type AdminInvite } from '@/lib/beheer';

interface InviteQrDialogProps {
  open: boolean;
  /** Kept by the caller while the dialog fades out */
  invite: AdminInvite | null;
  onOpenChange: (open: boolean) => void;
  now: number;
}

/** Beheer → Invites → ⋯ → QR-code tonen: the invite link as a QR code to scan, plus the link to copy. */
export default function InviteQrDialog({ open, invite, onOpenChange, now }: InviteQrDialogProps) {
  const url = invite?.url ?? '';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite {invite?.code}</DialogTitle>
          <DialogDescription>Laat iemand deze code scannen om een account te maken.</DialogDescription>
        </DialogHeader>
        {invite && (
          <div className="flex flex-col items-center gap-4">
            <TrackerQrCode value={url} size={220} label="QR-code van de invite" />
            <div className="flex w-full flex-col gap-2">
              <div className="flex gap-2">
                <Input readOnly value={url} aria-label="Link" className="font-mono text-xs" onFocus={(event) => event.target.select()} />
                <CopyButton value={url} label="Link" size="icon" />
              </div>
              <p className="text-xs text-muted-foreground">{inviteMeta(invite, now)}</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
