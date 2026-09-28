import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import useAdminStore from '@/stores/admin.store';
import type { User } from '@/types/User';
import AdminShell from './AdminShell';
import UsersPanel from './UsersPanel';

/** Settings → Admin tools → Gebruikers: account management. */
export default function UsersDialog() {
  const user = useAuthUser<User>();
  const open = useAdminStore((state) => state.dialog === 'users');
  const close = useAdminStore((state) => state.close);
  if (!user?.admin) return null;
  return (
    <AdminShell open={open} onClose={close} title="Gebruikers" description="Accounts aanmaken, bewerken en verwijderen.">
      <UsersPanel />
    </AdminShell>
  );
}
