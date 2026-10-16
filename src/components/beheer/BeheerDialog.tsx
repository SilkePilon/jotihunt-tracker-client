import { lazy, Suspense, useEffect, type RefObject } from 'react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import type { MapRef } from '@/components/Map';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import useAdminStore from '@/stores/admin.store';
import type { User } from '@/types/User';

interface BeheerDialogProps {
  /** For the Hunters pane's "Toon op kaart" */
  mapRef: RefObject<MapRef | null>;
}

// The window's content (all panes) is its own chunk, fetched once an admin is signed in so opening stays instant
const loadBeheerWindow = () => import('./BeheerWindow');
const BeheerWindow = lazy(loadBeheerWindow);

/** Gear menu → Beheer: settings, users, invites, hunters, broadcast and integrations in one window (admins only). */
export default function BeheerDialog({ mapRef }: BeheerDialogProps) {
  const user = useAuthUser<User>();
  const open = useAdminStore((state) => state.dialog !== null);
  const close = useAdminStore((state) => state.close);

  // The store is global: Layout unmounts on /login, and a window left open would pop up again after the next login
  useEffect(() => () => useAdminStore.getState().close(), []);
  const admin = !!user?.admin;
  useEffect(() => {
    if (admin) void loadBeheerWindow();
  }, [admin]);

  if (!admin) return null;
  return (
    <ResponsiveDialog
      open={open}
      onClose={close}
      title="Beheer"
      description="Instellingen, gebruikers, invites, hunters en koppelingen."
      hideHeader
      className="h-[640px] max-h-[85dvh] gap-0 overflow-hidden bg-beheer-window p-0 sm:max-w-[960px] sm:rounded-[20px]"
      drawerClassName="bg-beheer-window"
    >
      {/* Only mounted while the window is open (or closing) */}
      <Suspense fallback={<div className="min-h-0 flex-1" />}>
        <BeheerWindow mapRef={mapRef} />
      </Suspense>
    </ResponsiveDialog>
  );
}
