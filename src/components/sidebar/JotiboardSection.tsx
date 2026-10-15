import { toast } from 'sonner';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import JotiboardCard from '@/components/cards/jotiboard/JotiboardCard';
import { useJotiboardAdmin } from '@/hooks/jotiboard.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { jotiboardHeaderSummary, purgeText } from '@/lib/jotiboard';
import type { User } from '@/types/User';
import SidebarSection from './SidebarSection';

/** "Jotiboard" (admins only, under Life360): import fox pins and hint solutions from jotiboard.nl; closed by default. */
export default function JotiboardSection() {
  const user = useAuthUser<User>();
  const isAdmin = !!user?.admin;
  const { status, isError, link, unlink, setSyncEnabled, purge } = useJotiboardAdmin(isAdmin);

  if (!isAdmin) return null;

  return (
    <SidebarSection id="jotiboard" title="Jotiboard" summary={jotiboardHeaderSummary(status)}>
      <JotiboardCard
        status={status}
        isError={isError}
        onLink={async (username, password) => {
          try {
            await link(username, password);
            toast.success('Jotiboard gekoppeld');
            return null;
          } catch (error) {
            return apiErrorMessage(error, 'Koppelen is mislukt, probeer het opnieuw.');
          }
        }}
        onSetSync={async (enabled) => {
          try {
            await setSyncEnabled(enabled);
          } catch (error) {
            toast.error(apiErrorMessage(error, 'Aanpassen is mislukt, probeer het opnieuw.'));
          }
        }}
        onUnlink={async () => {
          try {
            await unlink();
            toast.success('Jotiboard ontkoppeld');
            return true;
          } catch (error) {
            toast.error(apiErrorMessage(error, 'Ontkoppelen is mislukt, probeer het opnieuw.'));
            return false;
          }
        }}
        onPurge={async () => {
          try {
            const removed = await purge();
            toast.success(`${purgeText(removed)} verwijderd`);
            return true;
          } catch (error) {
            toast.error(apiErrorMessage(error, 'Verwijderen is mislukt, probeer het opnieuw.'));
            return false;
          }
        }}
      />
    </SidebarSection>
  );
}
