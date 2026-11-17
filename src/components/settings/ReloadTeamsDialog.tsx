import { useState } from 'react';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';
import InlineError from '@/components/InlineError';
import Reveal from '@/components/motion/Reveal';
import { useTeams } from '@/hooks/teams.hook';
import { apiErrorMessage } from '@/lib/api-error';

interface ReloadTeamsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Admin confirmation for reloading all teams from the Jotihunt API; stays open (and busy) until the server answers.
 * Closes on success only: a failure stays in the dialog with the error and "Opnieuw proberen".
 */
export default function ReloadTeamsDialog({ open, onOpenChange }: ReloadTeamsDialogProps) {
  const { reloadTeams } = useTeams();
  const [error, setError] = useState<string | null>(null);

  function changeOpen(next: boolean) {
    if (!next) setError(null);
    onOpenChange(next);
  }

  async function handleReload() {
    setError(null);
    // Never throws; the error on failure (a 423 while an archive edition is shown reads "Archief is alleen-lezen")
    const failure = await reloadTeams();
    if (failure) {
      setError(apiErrorMessage(failure, 'Teams herladen is mislukt. Probeer het opnieuw.'));
      return;
    }
    toast.success('Teams herladen', {
      description: 'Alle teams zijn succesvol herladen vanuit de Jotihunt API.',
    });
    changeOpen(false);
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={changeOpen}
      title="Weet je zeker dat je alle teams wilt herladen?"
      description="Dit reset alle ingevulde deelgebieden. Deze actie kan niet ongedaan worden gemaakt."
      confirmLabel={error ? 'Opnieuw proberen' : 'Herladen'}
      onConfirm={handleReload}
    >
      {/* Cancels the dialog's gap above its extra content while there is no error, so the error unfolds instead of popping */}
      <div className="-mt-4">
        <Reveal>
          {error && (
            <div className="pt-4">
              <InlineError role="alert">Herladen mislukt: {error}</InlineError>
            </div>
          )}
        </Reveal>
      </div>
    </ConfirmDialog>
  );
}
