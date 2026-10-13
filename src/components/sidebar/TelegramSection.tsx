import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import TelegramCard, { type TelegramAdminProps } from '@/components/cards/telegram/TelegramCard';
import { revalidateTelegramViews, useTelegramAdmin, useTelegramMessages } from '@/hooks/telegram.hook';
import { apiErrorMessage } from '@/lib/api-error';
import { telegramSummary } from '@/lib/bot-messages';
import type { User } from '@/types/User';
import SidebarSection from './SidebarSection';

/** "Jotihunt-berichten": the @Jotihunt_bot messages; admins link the group's Telegram account here. Closed by default. */
export default function TelegramSection() {
  const user = useAuthUser<User>();
  const isAdmin = !!user?.admin;
  const { messages, linked } = useTelegramMessages();
  const { status, link, submitPassword, unlink } = useTelegramAdmin(isAdmin);

  // The QR scan (or password) completes on the server; the admin poll notices it: refresh the "linked" views
  const state = status?.state;
  const previousState = useRef(state);
  useEffect(() => {
    if (state === 'linked' && previousState.current && previousState.current !== 'linked') revalidateTelegramViews();
    previousState.current = state;
  }, [state]);

  const admin: TelegramAdminProps | undefined = isAdmin
    ? {
        status,
        onLink: async () => {
          try {
            await link();
          } catch (error) {
            toast.error(apiErrorMessage(error, 'Koppelen starten is mislukt, probeer het opnieuw.'));
          }
        },
        onCancel: async () => {
          try {
            await unlink();
          } catch (error) {
            toast.error(apiErrorMessage(error, 'Annuleren is mislukt, probeer het opnieuw.'));
          }
        },
        onSubmitPassword: async (password) => {
          try {
            await submitPassword(password);
            return null;
          } catch (error) {
            return apiErrorMessage(error, 'Koppelen is mislukt, probeer het opnieuw.');
          }
        },
        onUnlink: async () => {
          try {
            await unlink();
            return true;
          } catch (error) {
            toast.error(apiErrorMessage(error, 'Ontkoppelen is mislukt, probeer het opnieuw.'));
            return false;
          }
        },
      }
    : undefined;

  const summary = telegramSummary(messages) ?? (linked === false ? 'Niet gekoppeld' : undefined);

  return (
    <SidebarSection id="telegram" title="Jotihunt-berichten" summary={summary}>
      <TelegramCard messages={messages} admin={admin} />
    </SidebarSection>
  );
}
