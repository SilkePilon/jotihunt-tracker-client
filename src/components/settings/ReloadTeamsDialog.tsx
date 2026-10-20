import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useTeams } from '@/hooks/teams.hook';
import { apiErrorMessage } from '@/lib/api-error';

interface ReloadTeamsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Admin confirmation for reloading all teams from the Jotihunt API; stays open (and busy) until the server answers. */
export default function ReloadTeamsDialog({ open, onOpenChange }: ReloadTeamsDialogProps) {
  const { reloadTeams } = useTeams();

  async function handleReload() {
    // Never throws; the error on failure (a 423 while an archive edition is shown reads "Archief is alleen-lezen")
    const error = await reloadTeams();
    if (!error) {
      toast.success('Teams herladen', {
        description: 'Alle teams zijn succesvol herladen vanuit de Jotihunt API.',
      });
    } else {
      toast.error('Fout bij herladen teams', {
        description: apiErrorMessage(error, 'Er is iets misgegaan bij het herladen van de teams. Probeer het later opnieuw.'),
      });
    }
    onOpenChange(false);
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Weet je zeker dat je alle teams wilt herladen?"
      description="Dit reset alle ingevulde deelgebieden. Deze actie kan niet ongedaan worden gemaakt."
      confirmLabel="Herladen"
      onConfirm={handleReload}
    />
  );
}
