import { useEffect } from 'react';
import { Navigate } from 'react-router';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import useAdminStore from '@/stores/admin.store';
import type { User } from '@/types/User';

/** The old /users page now opens Beheer → Gebruikers on the map (admins only; others just land on the map). */
export default function Users() {
  const admin = !!useAuthUser<User>()?.admin;
  const openDialog = useAdminStore((state) => state.openDialog);

  useEffect(() => {
    // Only admins see the Beheer window; for anyone else the store would stay set and hold back the onboarding tour
    if (admin) openDialog('users');
  }, [admin, openDialog]);

  return <Navigate to="/" replace />;
}
