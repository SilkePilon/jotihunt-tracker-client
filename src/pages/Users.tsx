import { useEffect } from 'react';
import { Navigate } from 'react-router';
import useAdminStore from '@/stores/admin.store';

/** The old /users page now opens the "Gebruikers" tab of the Beheer dialog on the map. */
export default function Users() {
  const openAdmin = useAdminStore((state) => state.openAdmin);

  useEffect(() => {
    openAdmin('users');
  }, [openAdmin]);

  return <Navigate to="/" replace />;
}
