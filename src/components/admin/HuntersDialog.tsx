import { RefObject } from 'react';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { MapRef } from '@/components/Map';
import { useIsMobile } from '@/hooks/media.hook';
import useAdminStore from '@/stores/admin.store';
import useSidebarStore from '@/stores/sidebar.store';
import type { User } from '@/types/User';
import AdminShell from './AdminShell';
import HuntersPanel from './HuntersPanel';

/** Settings → Admin tools → Hunters: live overview of every tracker. */
export default function HuntersDialog({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const user = useAuthUser<User>();
  const isMobile = useIsMobile();
  const open = useAdminStore((state) => state.dialog === 'hunters');
  const close = useAdminStore((state) => state.close);
  const setSheetSnap = useSidebarStore((state) => state.setSheetSnap);
  if (!user?.admin) return null;

  function showOnMap(lng: number, lat: number) {
    close();
    if (isMobile) setSheetSnap('peek');
    mapRef.current?.flyTo({ center: [lng, lat], duration: 2000, zoom: 16 });
  }

  return (
    <AdminShell open={open} onClose={close} title="Hunters" description="Live locaties, statistieken en voertuig van alle trackers.">
      <HuntersPanel onShowOnMap={showOnMap} />
    </AdminShell>
  );
}
