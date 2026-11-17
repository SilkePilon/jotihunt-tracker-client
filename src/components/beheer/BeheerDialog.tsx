import { lazy, Suspense, useEffect, type RefObject } from 'react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import type { MapRef } from '@/components/Map';
import ChunkBoundary from '@/components/ChunkBoundary';
import ConfirmDialog from '@/components/ConfirmDialog';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import { useIsMobile } from '@/hooks/media.hook';
import { BeheerWindowSkeleton } from './BeheerSkeleton';
import { DIALOG_SHELL } from '@/lib/dialog-shell';
import { cn } from '@/lib/utils';
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
  const requestClose = useAdminStore((state) => state.requestClose);
  const leaving = useAdminStore((state) => state.pendingLeave !== null);
  const confirmLeave = useAdminStore((state) => state.confirmLeave);
  const cancelLeave = useAdminStore((state) => state.cancelLeave);
  const isMobile = useIsMobile();

  // The store is global: Layout unmounts on /login, and a window left open would pop up again after the next login
  useEffect(() => () => useAdminStore.getState().close(), []);
  const admin = !!user?.admin;
  useEffect(() => {
    if (admin) void loadBeheerWindow();
  }, [admin]);

  if (!admin) return null;
  return (
    <>
      <ResponsiveDialog
        open={open}
        // Unsaved Algemeen changes ask first; the window stays open (and Back re-arms) until the user agrees
        onClose={requestClose}
        title="Beheer"
        description="Instellingen, gebruikers, invites, hunters en koppelingen."
        hideHeader
        // Shell shared with Intel/Account/Meldingen (28px corners, tonal close button)
        className={cn(DIALOG_SHELL, 'h-[640px] max-h-[85dvh] gap-0 overflow-hidden bg-beheer-window p-0 sm:max-w-[960px]')}
        drawerClassName="bg-beheer-window"
      >
        {/* Only mounted while the window is open (or closing) */}
        <ChunkBoundary name="Beheer">
          <Suspense fallback={<BeheerWindowSkeleton mobile={isMobile} />}>
            <BeheerWindow mapRef={mapRef} />
          </Suspense>
        </ChunkBoundary>
      </ResponsiveDialog>
      <ConfirmDialog
        open={leaving}
        onOpenChange={(next) => !next && cancelLeave()}
        title="Wijzigingen weggooien?"
        description="Je wijzigingen in Algemeen zijn nog niet opgeslagen."
        cancelLabel="Verder bewerken"
        confirmLabel="Weggooien"
        destructive
        onConfirm={confirmLeave}
      />
    </>
  );
}
