import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLogout } from '@/hooks/logout.hook';
import { logoutDescription } from '@/lib/account';
import { apiErrorMessage } from '@/lib/api-error';

/** "Uitloggen op dit apparaat?" with the no-passkey lockout warning, as in Account's session list; for the gear menu. */
export default function LogoutConfirmDialog({ open, onOpenChange, noPasskey }: { open: boolean; onOpenChange: (open: boolean) => void; noPasskey: boolean }) {
  const logout = useLogout();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Uitloggen op dit apparaat?"
      description={logoutDescription(noPasskey)}
      confirmLabel="Uitloggen"
      onConfirm={async () => {
        try {
          await logout();
          onOpenChange(false);
        } catch (failure) {
          toast.error(apiErrorMessage(failure, 'Uitloggen is mislukt, probeer het opnieuw.'));
        }
      }}
    />
  );
}
