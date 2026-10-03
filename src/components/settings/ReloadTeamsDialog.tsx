import { useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTeams } from '@/hooks/teams.hook';

interface ReloadTeamsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Admin confirmation for reloading all teams from the Jotihunt API; stays open (and busy) until the server answers. */
export default function ReloadTeamsDialog({ open, onOpenChange }: ReloadTeamsDialogProps) {
  const { reloadTeams } = useTeams();
  const [isReloading, setIsReloading] = useState(false);

  async function handleReload() {
    setIsReloading(true);
    try {
      // Never throws; false on any error (e.g. 409 while demo mode is on)
      const ok = await reloadTeams();
      if (ok) {
        toast.success('Teams herladen', {
          description: 'Alle teams zijn succesvol herladen vanuit de Jotihunt API.',
        });
      } else {
        toast.error('Fout bij herladen teams', {
          description: 'Er is iets misgegaan bij het herladen van de teams. Probeer het later opnieuw.',
        });
      }
    } finally {
      setIsReloading(false);
      onOpenChange(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!isReloading) onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Weet je zeker dat je alle teams wilt herladen?</AlertDialogTitle>
          <AlertDialogDescription>
            Dit reset alle ingevulde deelgebieden. Deze actie kan niet ongedaan worden gemaakt.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isReloading}>Annuleren</AlertDialogCancel>
          <AlertDialogAction
            disabled={isReloading}
            onClick={(e) => {
              e.preventDefault();
              void handleReload();
            }}
          >
            {isReloading && <Loader2Icon className="animate-spin" />}
            Herladen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
