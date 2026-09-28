import { RefObject } from 'react';
import { Drawer } from 'vaul';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { MapRef } from '@/components/Map';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useIsMobile } from '@/hooks/media.hook';
import useAdminStore, { type AdminTab } from '@/stores/admin.store';
import useSidebarStore from '@/stores/sidebar.store';
import type { User } from '@/types/User';
import HuntersPanel from './HuntersPanel';
import UsersPanel from './UsersPanel';

function Tabs() {
  const tab = useAdminStore((state) => state.tab);
  const setTab = useAdminStore((state) => state.setTab);
  return (
    <ToggleGroup type="single" variant="outline" value={tab} onValueChange={(value) => value && setTab(value as AdminTab)} className="w-full md:w-auto">
      <ToggleGroupItem value="hunters" className="flex-1 md:flex-none md:px-4">
        Hunters
      </ToggleGroupItem>
      <ToggleGroupItem value="users" className="flex-1 md:flex-none md:px-4">
        Gebruikers
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

/**
 * "Beheer" (admins only): live hunters and user accounts. A large dialog on desktop, a bottom drawer on phones.
 */
export default function AdminDialog({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const user = useAuthUser<User>();
  const isMobile = useIsMobile();
  const open = useAdminStore((state) => state.open);
  const tab = useAdminStore((state) => state.tab);
  const close = useAdminStore((state) => state.close);
  const setSheetSnap = useSidebarStore((state) => state.setSheetSnap);

  if (!user?.admin) return null;

  function showOnMap(lng: number, lat: number) {
    close();
    if (isMobile) setSheetSnap('peek');
    mapRef.current?.flyTo({ center: [lng, lat], duration: 2000, zoom: 16 });
  }

  const body = open && (tab === 'hunters' ? <HuntersPanel onShowOnMap={showOnMap} /> : <UsersPanel />);

  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={(next) => !next && close()}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex h-[92dvh] flex-col rounded-t-2xl border-t bg-background outline-none">
            <Drawer.Handle className="mx-auto mb-1 mt-2" />
            <div className="flex flex-col gap-2 px-4 pb-3 pt-1">
              <Drawer.Title className="text-lg font-semibold">Beheer</Drawer.Title>
              <Drawer.Description className="sr-only">Actieve hunters en gebruikers beheren</Drawer.Description>
              <Tabs />
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{body}</div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="flex h-[85dvh] max-h-[85dvh] flex-col gap-3 sm:max-w-4xl">
        <DialogHeader className="flex-row items-center gap-4 pr-8">
          <DialogTitle className="text-xl">Beheer</DialogTitle>
          <DialogDescription className="sr-only">Actieve hunters en gebruikers beheren</DialogDescription>
          <Tabs />
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
