import { RefObject } from 'react';
import { toast } from 'sonner';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import Life360Card from '@/components/cards/life360/Life360Card';
import type { MapRef } from '@/components/Map';
import CookieBadge from '@/components/tracker/CookieBadge';
import { useLife360Admin, useLife360Members } from '@/hooks/life360.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { life360HeaderSummary } from '@/lib/life360';
import { cn } from '@/lib/utils';
import useSidebarStore from '@/stores/sidebar.store';
import type { Life360Member } from '@/types/Life360';
import type { User } from '@/types/User';
import SidebarSection from './SidebarSection';

/** Runs `action`; null when it succeeded, else the server's (Dutch) error text. */
async function errorText(action: () => Promise<unknown>, fallback: string): Promise<string | null> {
  try {
    await action();
    return null;
  } catch (error) {
    return apiErrorMessage(error, fallback);
  }
}

/** "Life360" (admins only, under "Mijn tracker"): link the team's Life360 account; closed by default. */
export default function Life360Section({ mapRef }: { mapRef: RefObject<MapRef | null> }) {
  const user = useAuthUser<User>();
  const isAdmin = !!user?.admin;
  const { status, isError, sendCode, verifyCode, chooseCircle, submitToken, requestFreshLocations, unlink } = useLife360Admin(isAdmin);
  const { data: members } = useLife360Members(isAdmin && status?.state === 'linked');
  const setSheetSnap = useSidebarStore((state) => state.setSheetSnap);

  if (!isAdmin) return null;

  function flyTo(member: Life360Member) {
    if (!member.location) return;
    mapRef.current?.flyTo({ center: [member.location.lon, member.location.lat], zoom: 15, essential: true });
    setSheetSnap('peek');
  }

  const header = life360HeaderSummary(status);
  const summary =
    header &&
    (header.tone ? (
      <span className={cn('inline-flex items-center gap-1.5', header.tone === 'warn' && 'font-medium text-amber-600 dark:text-amber-400')}>
        {header.text}
        <CookieBadge tone={header.tone} size={18} />
      </span>
    ) : (
      header.text
    ));

  return (
    <SidebarSection id="life360" title="Life360" summary={summary}>
      <Life360Card
        status={status}
        isError={isError}
        members={members?.members}
        onSendCode={(email) => errorText(() => sendCode(email), 'Code versturen is mislukt, probeer het opnieuw.')}
        onVerifyCode={(code) => errorText(() => verifyCode(code), 'Koppelen is mislukt, probeer het opnieuw.')}
        onChooseCircle={(circleId) => errorText(() => chooseCircle(circleId), 'Cirkel kiezen is mislukt, probeer het opnieuw.')}
        onSubmitToken={(token) => errorText(() => submitToken(token), 'Koppelen met token is mislukt, probeer het opnieuw.')}
        onCancel={async () => {
          try {
            await unlink();
          } catch (error) {
            toast.error(apiErrorMessage(error, 'Annuleren is mislukt, probeer het opnieuw.'));
          }
        }}
        onRefresh={async () => {
          try {
            await requestFreshLocations();
            toast.success('Life360 vraagt nieuwe locaties op');
          } catch (error) {
            toast.error(apiErrorMessage(error, 'Verversen is mislukt, probeer het later opnieuw.'));
          }
        }}
        onUnlink={async () => {
          try {
            await unlink();
            return true;
          } catch (error) {
            toast.error(apiErrorMessage(error, 'Ontkoppelen is mislukt, probeer het opnieuw.'));
            return false;
          }
        }}
        onFlyTo={flyTo}
      />
    </SidebarSection>
  );
}
