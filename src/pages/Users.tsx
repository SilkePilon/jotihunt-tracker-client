import { useEffect } from 'react';
import { Navigate } from 'react-router';
import useAdminStore from '@/stores/admin.store';

/** The old /users page now opens the Gebruikers dialog on the map. */
export default function Users() {
  const openDialog = useAdminStore((state) => state.openDialog);

  useEffect(() => {
    openDialog('users');
  }, [openDialog]);

  return <Navigate to="/" replace />;
}
